import pg from "pg";
import { AuroraDSQLPool } from "@aws/aurora-dsql-node-postgres-connector";
import { config } from "./config.js";

const { Pool } = pg;

let pool;

function dsqlHost() {
  if (!config.dsqlClusterId) return "";
  return `${config.dsqlClusterId}.dsql.${config.dsqlRegion}.on.aws`;
}

export function isDsqlMode() {
  return Boolean(config.dsqlClusterId);
}

export function getPool() {
  if (pool) return pool;

  if (config.dsqlClusterId) {
    pool = new AuroraDSQLPool({
      host: dsqlHost(),
      user: config.dsqlUser,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      retry: { maxRetries: 5 }
    });
    return pool;
  }

  if (!config.databaseUrl) {
    throw new Error("Configure DATABASE_URL ou DSQL_CLUSTER_ID em backend/.env");
  }

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("sslmode=require") || process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : undefined,
    max: 10
  });
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}
