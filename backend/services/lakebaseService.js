import pg from "pg";
import { getDatabricksConfig, lakebaseConfig } from "../config/databricks.js";
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
  const accessToken = await getAccessToken();

  const res = await fetch(`https://${config.host}/api/2.0/postgres/credentials`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ endpoint: lakebaseConfig.endpoint, ttl: "3600s" }),
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
