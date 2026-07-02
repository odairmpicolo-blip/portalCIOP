/**
 * Exporta telemetria do DSQL para assets/data/telemetria/dados.json (GitHub Pages).
 *
 * Uso:
 *   DSQL_CLUSTER_ID=... DSQL_REGION=sa-east-1 node scripts/atualizar-telemetria-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../backend/src/db.js";
import { normalizarLinhaTelemetria } from "../backend/src/lib/telemetria-merge.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "assets/data/telemetria");

function normalizarDataIso(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(val).slice(0, 10);
}

async function main() {
  const res = await query(
    `SELECT data_iso, veiculo, payload, origem_arquivo, atualizado_em
     FROM telemetria_linhas
     ORDER BY data_iso, veiculo`
  );
  const dados = res.rows.map((r) => ({
    data_iso: normalizarDataIso(r.data_iso),
    veiculo: r.veiculo,
    payload: normalizarLinhaTelemetria(r.payload),
    origem_arquivo: r.origem_arquivo || null
  }));
  const datas = dados.map((d) => d.data_iso).filter(Boolean).sort();
  const atualizadoEm = new Date().toISOString();
  const snapshot = {
    atualizadoEm,
    total: dados.length,
    data_de: datas[0] || null,
    data_ate: datas[datas.length - 1] || null,
    dados
  };
  const manifest = {
    atualizadoEm,
    arquivo: "dados.json",
    total: dados.length,
    data_de: snapshot.data_de,
    data_ate: snapshot.data_ate
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "dados.json"), `${JSON.stringify(snapshot)}\n`);
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Telemetria JSON: ${dados.length} registro(s) · ${snapshot.data_de} a ${snapshot.data_ate}`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
