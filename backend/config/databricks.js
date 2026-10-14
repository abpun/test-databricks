import dotenv from "dotenv";

dotenv.config();

export const databricksConfig = {
  host: process.env.DATABRICKS_HOST || "",
  clientId: process.env.SA_CLIENT_ID || "",
  secret: process.env.SA_CLIENT_SECRET || "",
};
export const getDatabricksConfig = () => {
  const { host, secret, clientId } = databricksConfig;
  console.log("Databricks config:", databricksConfig);

  if (!host || !secret || !clientId) {
    throw new Error(
      "Missing Databricks config. Set DATABRICKS_HOST, DATABRICKS_CLIENT_SECRET, and DATABRICKS_CLIENT_ID.",
    );
  }

  return databricksConfig;
};
