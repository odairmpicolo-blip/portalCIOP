import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.join(__dirname, "..", "sql");

function splitSqlStatements(sql) {
  const semComentarios = sql.replace(/--[^\n]*/g, "");
  return semComentarios
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

function ignorableMigrateError(err) {
  const msg = String(err.message || "");
  return (
    err.code === "42P07" ||
    err.code === "42710" ||
    /already exists/i.test(msg)
  );
}

async function applyFile(fileName) {
  const filePath = path.join(sqlDir, fileName);
  const statements = splitSqlStatements(fs.readFileSync(filePath, "utf8"));
  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch (err) {
      if (ignorableMigrateError(err)) continue;
      throw err;
    }
  }
  return statements.length;
}

async function main() {
  const tables = await applyFile("schema.sql");
  const indexes = await applyFile("schema-indexes.sql");
  console.log(`Schema aplicado: ${tables} tabelas, ${indexes} índice(s) async`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
