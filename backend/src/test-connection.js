import { query, closePool, isDsqlMode } from "./db.js";

async function main() {
  const res = await query("SELECT NOW() AS agora, current_database() AS banco");
  console.log("Conexão OK (" + (isDsqlMode() ? "DSQL" : "PostgreSQL") + "):", res.rows[0]);
  await closePool();
}

main().catch((err) => {
  console.error("Falha na conexão:", err.message);
  process.exit(1);
});
