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
export const lakebaseConfig = {
  endpoint:
    process.env.LAKEBASE_ENDPOINT ||
    "projects/bsar-app-test/branches/production/endpoints/primary",
  host:
    process.env.PGHOST ||
    "ep-solitary-bird-d8y6m06l.database.us-east-2.cloud.databricks.com",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "databricks_postgres",
  // The Postgres role for the app's service principal is its client id.
  user: process.env.PGUSER || process.env.DATABRICKS_CLIENT_ID || "",
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
