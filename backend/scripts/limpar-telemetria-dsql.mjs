/**
 * Remove registros de telemetria importados por arquivo (origem_arquivo) do DSQL.
 *
 * Uso:
 *   node backend/scripts/limpar-telemetria-dsql.mjs
 *
 * Obs: não remove linhas sem origem_arquivo (caso existam).
 */
import { query, closePool } from "../src/db.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "assets/data/telemetria");

async function main() {
  const dist = await query(
    "SELECT origem_arquivo, COUNT(*)::int AS n FROM telemetria_linhas WHERE origem_arquivo IS NOT NULL AND origem_arquivo <> '' GROUP BY origem_arquivo ORDER BY n DESC, origem_arquivo ASC"
  );
  if (!dist.rows.length) {
    console.log("Nenhum registro com origem_arquivo para remover.");
  } else {
    console.log("Arquivos encontrados (origem_arquivo):");
    dist.rows.forEach((r) => console.log(`- ${r.origem_arquivo}: ${r.n}`));
  }

  const before = await query("SELECT COUNT(*)::int AS n FROM telemetria_linhas");
  const del = await query(
    "DELETE FROM telemetria_linhas WHERE origem_arquivo IS NOT NULL AND origem_arquivo <> ''"
  );
  const after = await query("SELECT COUNT(*)::int AS n FROM telemetria_linhas");

  console.log(`Antes: ${before.rows[0].n} | Removidos: ${del.rowCount} | Depois: ${after.rows[0].n}`);

  // Zera o snapshot JSON no portal (para não continuar exibindo dados antigos)
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "dados.json"), `${JSON.stringify({ atualizadoEm: new Date().toISOString(), total: 0, data_de: null, data_ate: null, dados: [] })}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify({ atualizadoEm: new Date().toISOString(), arquivo: "dados.json", total: 0, data_de: null, data_ate: null }, null, 2)}\n`);
  console.log("Snapshot JSON zerado em assets/data/telemetria/.");

  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

