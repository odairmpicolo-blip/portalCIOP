/**
 * Envia snapshots JSON locais para a API AWS (PostgreSQL).
 *
 * Uso:
 *   PORTAL_AWS_API_URL=http://localhost:3000 PORTAL_API_KEY=dev node scripts/importar-snapshots-aws.mjs
 *   PORTAL_AWS_API_URL=... PORTAL_API_KEY=... node scripts/importar-snapshots-aws.mjs terminais incidentes
 */

import fs from "node:fs";
import path from "node:path";

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const apiUrl = (process.env.PORTAL_AWS_API_URL || "").replace(/\/$/, "");
const apiKey = process.env.PORTAL_API_KEY || "";

const JOBS = {
  terminais: {
    path: ["assets", "data", "terminais-agora.json"],
    put: (base) => `${base}/terminais/atual`
  },
  incidentes: {
    path: ["assets", "data", "incidentes-tcgl.json"],
    put: (base) => `${base}/snapshots/incidentes`
  },
  autuacoes: {
    path: ["assets", "data", "autuacoes", "dados.json"],
    put: (base) => `${base}/snapshots/autuacoes`
  },
  folha: {
    path: ["assets", "data", "folha-servico", "todos.json"],
    put: (base) => `${base}/snapshots/folha`
  },
  pontualidade_padrao: {
    path: ["assets", "data", "pontualidade", "padrao.json"],
    put: (base) => `${base}/snapshots/pontualidade/padrao`
  },
  pontualidade_alternativo: {
    path: ["assets", "data", "pontualidade", "alternativo.json"],
    put: (base) => `${base}/snapshots/pontualidade/alternativo`
  }
};

async function enviar(nome, job) {
  const filePath = path.join(portalRoot, ...job.path);
  if (!fs.existsSync(filePath)) {
    console.warn(`[${nome}] arquivo não encontrado: ${filePath}`);
    return;
  }
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const res = await fetch(job.put(apiUrl), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Portal-Api-Key": apiKey
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`[${nome}] ${data.erro || res.statusText}`);
  }
  console.log(`[${nome}] enviado`);
}

async function main() {
  if (!apiUrl || !apiKey) {
    console.error("Configure PORTAL_AWS_API_URL e PORTAL_API_KEY");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const selecionados = args.length
    ? args
    : Object.keys(JOBS);
  for (const nome of selecionados) {
    const job = JOBS[nome];
    if (!job) {
      console.warn(`Job desconhecido: ${nome}`);
      continue;
    }
    await enviar(nome, job);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
