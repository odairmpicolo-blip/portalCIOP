/**
 * Envia snapshot de terminais para a API AWS (PostgreSQL).
 *
 * Uso:
 *   PORTAL_AWS_API_URL=https://... PORTAL_API_KEY=... node scripts/importar-terminais-aws.mjs
 */

import fs from "node:fs";
import path from "node:path";

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const apiUrl = (process.env.PORTAL_AWS_API_URL || "").replace(/\/$/, "");
const apiKey = process.env.PORTAL_API_KEY || "";
const jsonPath = path.join(portalRoot, "assets", "data", "terminais-agora.json");

async function main() {
  if (!apiUrl || !apiKey) {
    console.error("Configure PORTAL_AWS_API_URL e PORTAL_API_KEY");
    process.exit(1);
  }
  if (!fs.existsSync(jsonPath)) {
    console.error("Arquivo não encontrado:", jsonPath);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const res = await fetch(`${apiUrl}/terminais/atual`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Portal-Api-Key": apiKey
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(data.erro || res.statusText);
    process.exit(1);
  }
  console.log("Terminais enviados para AWS:", payload.totalRegistros || payload.REGISTROS?.length || 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
