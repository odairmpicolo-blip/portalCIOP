/**
 * Atualiza snapshot JSON de Terminais Agora a partir da planilha Google.
 *
 * Uso:
 *   node scripts/atualizar-terminais-planilha.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { carregarSnapshotPlanilha, serializarSnapshot } from "./lib/terminais-planilha-core.mjs";

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const destino = path.join(portalRoot, "assets", "data", "terminais-agora.json");

async function main() {
  console.log("Lendo planilha de terminais...");
  const snapshot = await carregarSnapshotPlanilha();
  const payload = serializarSnapshot(snapshot);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Salvo: ${destino}`);
  console.log(`Dados: ${payload.totalDados} | Registros: ${payload.totalRegistros}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
