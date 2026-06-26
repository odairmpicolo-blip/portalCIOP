/**
 * Exporta incidentes_snapshot (Aurora DSQL) → assets/data/incidentes-tcgl.json
 *
 * Uso (em backend/):
 *   npm run export:incidentes-dsql
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDsqlPool, lerSnapshot } from "./lib/dsql-import.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.join(__dirname, "..", "..");
const dataDir = process.env.PORTAL_DATA_DIR || path.join(portalRoot, "assets", "data");
const outFile = path.join(dataDir, "incidentes-tcgl.json");

function normalizarPayload(raw, atualizadoEm) {
  const payload = typeof raw === "string" ? JSON.parse(raw) : { ...raw };
  const n = payload.incidentes?.length || payload.totalExtraido || 0;
  payload.totalExtraido = n;
  payload.fonte = payload.fonte || "Gerenciamento de Incidentes";
  payload.empresa = payload.empresa || "TCGL";
  payload.origemExport = "aurora-dsql";
  if (atualizadoEm) {
    payload.atualizadoEm = atualizadoEm instanceof Date
      ? atualizadoEm.toISOString()
      : String(atualizadoEm);
  }
  payload.exportadoEm = new Date().toISOString();
  return payload;
}

async function main() {
  const pool = createDsqlPool();
  try {
    const snap = await lerSnapshot(pool, "incidentes_snapshot");
    if (!snap?.payload) {
      throw new Error("Snapshot incidentes vazio ou inexistente no DSQL.");
    }
    const payload = normalizarPayload(snap.payload, snap.atualizadoEm);
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
    const n = payload.incidentes?.length || 0;
    console.log(`[export] ${n} incidentes DSQL → ${outFile}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[export] ERRO:", err.message);
  process.exit(1);
});
