import pg from "pg";
import {
  getDatabricksConfig,
  getLakebaseConfig,
  lakebaseConfig,
} from "../config/databricks.js";
import { getAccessToken } from "./databricksAuth.js";

const { Pool } = pg;

const TABLE = "uploaded_files";

let pool;
let dbCred = { token: null, expiresAt: 0 };

/**
 * Generates a short-lived Lakebase Postgres credential (used as the PG password)
 * for the app's service principal via the Postgres credentials API.
 */
async function getDbCredential() {
  const now = Date.now();
  if (dbCred.token && now < dbCred.expiresAt - 60_000) {
    return dbCred.token;
  }

  const config = getDatabricksConfig();
  const lakebase = getLakebaseConfig();
  const accessToken = await getAccessToken();

  const res = await fetch(`https://${config.host}/api/2.0/postgres/credentials`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint: lakebase.endpoint, ttl: "3600s" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to generate Lakebase credential: ${res.status} ${text}`);
  }

  const data = await res.json();
  const token = data.token || data.credential || data.access_token;
  if (!token) {
    throw new Error("Lakebase credential response did not contain a token");
  }

  // Tokens are typically valid ~1h; refresh a minute early regardless of response shape.
  const expMs = data.expiration_time
    ? new Date(data.expiration_time).getTime()
    : Date.now() + 3600_000;
  dbCred = { token, expiresAt: expMs };
  return token;
}

function getPool() {
  if (pool) return pool;

  getLakebaseConfig();

  pool = new Pool({
    host: lakebaseConfig.host,
    port: lakebaseConfig.port,
    database: lakebaseConfig.database,
    user: lakebaseConfig.user,
    // node-postgres calls this per new connection, so the token stays fresh.
    password: async () => getDbCredential(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

  pool.on("error", (err) => console.error("Lakebase pool error:", err));
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

/**
 * Creates the uploaded_files table if it does not already exist.
 * Requires the connecting role to have CREATE on schema public.
 */
export async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      file_name   TEXT        NOT NULL,
      volume_path TEXT        NOT NULL,
      bsar_id     TEXT        NOT NULL,
      gjahr       TEXT        NOT NULL,
      poper       TEXT        NOT NULL,
      content_type TEXT,
      size_bytes  BIGINT,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await query(sql);
}

export async function insertFileRecord({
  fileName,
  volumePath,
  bsarId,
  gjahr,
  poper,
  contentType,
  sizeBytes,
  uploadedBy,
}) {
  const sql = `
    INSERT INTO ${TABLE}
      (file_name, volume_path, bsar_id, gjahr, poper, content_type, size_bytes, uploaded_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, file_name, volume_path, bsar_id, gjahr, poper,
              content_type, size_bytes, uploaded_by, uploaded_at;
  `;
  const { rows } = await query(sql, [
    fileName,
    volumePath,
    bsarId,
    gjahr,
    poper,
    contentType ?? null,
    sizeBytes ?? null,
    uploadedBy ?? null,
  ]);
  return rows[0];
}

export async function getFileById(id) {
  const sql = `
    SELECT id, file_name, volume_path, content_type, size_bytes
    FROM ${TABLE}
    WHERE id = $1;
  `;
  const { rows } = await query(sql, [id]);
  return rows[0] ?? null;
}

export async function listFiles(limit = 100) {
  const sql = `
    SELECT id, file_name, volume_path, bsar_id, gjahr, poper,
           content_type, size_bytes, uploaded_by, uploaded_at
    FROM ${TABLE}
    ORDER BY uploaded_at DESC
    LIMIT $1;
  `;
  const { rows } = await query(sql, [limit]);
  return rows;
}

/**
 * Separates the two stages that both surface as connection failures:
 *   1. minting the Lakebase credential (workspace OAuth + instance permission)
 *   2. the Postgres login itself (requires a role named after the client id)
 * Returns the stage that failed plus the raw Postgres error code, which
 * distinguishes a missing role / bad password (28P01, 28000) from a missing
 * database (3D000) or an unreachable host (ENOTFOUND, ETIMEDOUT).
 */
export async function diagnose() {
  const result = {
    endpoint: lakebaseConfig.endpoint,
    host: lakebaseConfig.host,
    database: lakebaseConfig.database,
    role: lakebaseConfig.user,
    mint: "not_attempted",
    connect: "not_attempted",
  };

  let token;
  try {
    token = await getDbCredential();
    result.mint = "ok";
    result.token_length = token.length;
  } catch (err) {
    result.mint = "failed";
    result.mint_error = err.message;
    return result;
  }

  const client = new pg.Client({
    host: lakebaseConfig.host,
    port: lakebaseConfig.port,
    database: lakebaseConfig.database,
    user: lakebaseConfig.user,
    password: token,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT current_user, current_database(), version()",
    );
    result.connect = "ok";
    result.current_user = rows[0].current_user;
    result.current_database = rows[0].current_database;
  } catch (err) {
    result.connect = "failed";
    result.connect_error = err.message;
    result.pg_code = err.code ?? null;
    result.hint =
      err.code === "28P01" || err.code === "28000"
        ? `The credential was minted but Postgres rejected the login. The role "${lakebaseConfig.user}" most likely does not exist on this instance. Create it as databricks_superuser: CREATE ROLE "${lakebaseConfig.user}" WITH LOGIN IN ROLE databricks_superuser;`
        : err.code === "3D000"
          ? `Database "${lakebaseConfig.database}" does not exist on this instance; set PGDATABASE.`
          : "Not an authentication failure; see connect_error.";
  } finally {
    await client.end().catch(() => {});
  }

  return result;
}
