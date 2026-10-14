import { DBSQLClient } from "@databricks/sql";
import { getDatabricksConfig } from "../config/databricks.js";

let clientPromise;
const catalog = "tsed_corporate_dev";
const schema = "finance_gold";

export async function getClient() {
  if (clientPromise) return clientPromise;

  const config = getDatabricksConfig();
  clientPromise = (async () => {
    const client = new DBSQLClient();
    client.on("error", (err) => console.error("Databricks client error:", err));

    await client.connect({
      host: config.host,
      authType: "databricks-oauth",
      oauthClientId: config.clientId,
      oauthClientSecret: config.secret,
      path: "/sql/1.0/warehouses/66ee3aa74b56597c",
    });

    return client;
  })().catch((err) => {
    console.error("Error connecting to Databricks:", err);
    clientPromise = null;
    throw err;
  });

  return clientPromise;
}

export async function runQuery(sql) {
  const client = await getClient();
  const session = await client.openSession({
    initialCatalog: catalog,
    initialSchema: schema,
  });

  let operation;
  const startedAt = Date.now();

  try {
    operation = await session.executeStatement(sql, {
      runAsync: true,
      queryTimeout: 60,
    });

    const rows = await operation.fetchAll();
    return rows;
  } catch (err) {
    throw err;
  } finally {
    if (operation) {
      try {
        await operation.close();
        await session.close();
      } catch (err) {
        console.log(err);
      }
    }
  }
}

export async function getTableNames() {
  const sql = `SHOW TABLES IN ${catalog}.${schema}`;
  return runQuery(sql);
}

export async function getTableData(tableName, limit = 20) {
  const qualifiedName = buildQualifiedTableName(tableName);
  const sql = `SELECT * FROM ${qualifiedName} LIMIT ${limit}`;
  console.log(`SQL: ${sql}`);
  return runQuery(sql);
}

export async function getBalanceData(limit = 20) {
  return getTableData("vw_bsar_cumulative_balance", limit);
}

export async function getTransactionalData(limit = 20) {
  return getTableData("vw_bsar_acdoca_transactional", limit);
}

function buildQualifiedTableName(tableName) {
  return `${catalog}.${schema}.${tableName}`;
}
