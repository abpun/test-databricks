import dotenv from "dotenv";

dotenv.config();

/**
 * In Databricks Apps, the platform injects DATABRICKS_HOST,
 * DATABRICKS_CLIENT_ID and DATABRICKS_CLIENT_SECRET for the app's
 * service principal. We authenticate everything (Volumes, SQL warehouse,
 * Lakebase) as that service principal via OAuth client credentials.
 */
export const databricksConfig = {
  host: (process.env.DATABRICKS_HOST || "").replace(/^https?:\/\//, ""),
  clientId: process.env.DATABRICKS_CLIENT_ID || "",
  secret: process.env.DATABRICKS_CLIENT_SECRET || "",
};

// Lakebase (Autoscaling Postgres) connection settings.
// LAKEBASE_ENDPOINT and PGHOST have no defaults on purpose: they must name the
// SAME Lakebase instance. The credential is minted scoped to LAKEBASE_ENDPOINT,
// so pointing it at one instance while PGHOST points at another fails with
// "password authentication failed for user '<client-id>'".
export const lakebaseConfig = {
  endpoint: process.env.LAKEBASE_ENDPOINT || "",
  host: process.env.PGHOST || "",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "databricks_postgres",
  // The Postgres role for the app's service principal is its client id.
  user: process.env.PGUSER || process.env.DATABRICKS_CLIENT_ID || "",
};

let loggedTarget = false;

export const getLakebaseConfig = () => {
  const { endpoint, host, user } = lakebaseConfig;
  const missing = [
    !endpoint && "LAKEBASE_ENDPOINT (e.g. projects/<project>/branches/<branch>/endpoints/<endpoint>)",
    !host && "PGHOST (e.g. ep-xxxx.database.<region>.cloud.databricks.com)",
    !user && "PGUSER or DATABRICKS_CLIENT_ID",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`Missing Lakebase config. Set: ${missing.join(", ")}`);
  }

  // The endpoint path and the host cannot be cross-checked from their text
  // alone (the path ends in a logical name, the host is a generated id), so
  // log both once: a stale pairing is only diagnosable by reading them.
  if (!loggedTarget) {
    loggedTarget = true;
    console.log(
      `[lakebase] credential endpoint=${endpoint} -> connecting host=${host} ` +
        `db=${lakebaseConfig.database} role=${user}`,
    );
  }

  return lakebaseConfig;
};

export const getDatabricksConfig = () => {
  const { host, secret, clientId } = databricksConfig;

  if (!host || !secret || !clientId) {
    throw new Error(
      "Missing Databricks config. Set DATABRICKS_HOST, DATABRICKS_CLIENT_ID, and DATABRICKS_CLIENT_SECRET.",
    );
  }

  return databricksConfig;
};
