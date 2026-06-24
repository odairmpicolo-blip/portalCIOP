/**
 * Envia ao Aurora DSQL os mesmos snapshots que as planilhas/APIs geram em assets/data/
 * (mesma lógica de alimentação que Firestore + JSON no GitHub Actions).
 *
 * Uso (em backend/):
 *   npm run import:planilha-dsql
 *   npm run import:planilha-dsql -- terminais incidentes liberacao
 *   npm run import:planilha-dsql -- liberacao-hoje
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDsqlPool,
  upsertSnapshot,
  upsertTerminais,
  upsertPontualidade,
  gravarLiberacaoLinhas
} from "./lib/dsql-import.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.join(__dirname, "..", "..");
const dataDir = process.env.PORTAL_DATA_DIR || path.join(portalRoot, "assets", "data");
const PORTAL_TZ = process.env.PORTAL_TZ || "America/Sao_Paulo";
const LIBERACAO_URL = process.env.LIBERACAO_API_URL
  || process.env.FOLHA_SERVICO_API_URL
  || "https://script.google.com/macros/s/AKfycby9hpIGulGYxlm_Oseasi_D2GIaLSvusFNqcgrSj7l7HwxcUXLTPqd8kX1JxwkCx9lqOA/exec";
const DIAS_JANELA = Number(process.env.LIBERACAO_DIAS_JANELA || 7);
const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 180000);

const JOBS = [
  "terminais",
  "incidentes",
  "autuacoes",
  "folha",
  "pontualidade",
  "liberacao",
  "liberacao-hoje"
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function partesDataPortal(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);
  const get = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

function isoDataLocal(offsetDias = 0) {
  const { year, month, day } = partesDataPortal(new Date());
  const d = new Date(Date.UTC(year, month - 1, day + offsetDias));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function listarJanelaLiberacao() {
  const dataDe = isoDataLocal(-DIAS_JANELA);
  const dataAte = isoDataLocal(1);
  const dias = [];
  const [y0, m0, d0] = dataDe.split("-").map(Number);
  const [y1, m1, d1] = dataAte.split("-").map(Number);
  const cursor = new Date(Date.UTC(y0, m0 - 1, d0));
  const fim = new Date(Date.UTC(y1, m1 - 1, d1));
  while (cursor <= fim) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { dataDe, dataAte, dias };
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function buscarLiberacaoDiaApi(dataIso) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "acompanhamento",
    data: dataIso,
    limit: "0",
    vivo: "1",
    _: String(Date.now())
  })}`;
  const res = await fetchJson(url);
  if (!res.ok) throw new Error(res.erro || `Falha liberação ${dataIso}`);
  return res.dados || [];
}

async function importTerminais(pool) {
  const file = path.join(portalRoot, "assets", "data", "terminais-agora.json");
  const payload = readJson(file);
  if (!payload) {
    console.warn("[terminais] JSON não encontrado");
    return;
  }
  await upsertTerminais(pool, payload);
  const n = payload.REGISTROS?.length || payload.totalRegistros || 0;
  console.log(`[terminais] ${n} registros (planilha → DSQL)`);
}

async function importIncidentes(pool) {
  const file = path.join(dataDir, "incidentes-tcgl.json");
  const payload = readJson(file);
  if (!payload) {
    console.warn("[incidentes] JSON não encontrado");
    return;
  }
  await upsertSnapshot(pool, "incidentes_snapshot", payload);
  const n = payload.incidentes?.length || payload.totalExtraido || 0;
  console.log(`[incidentes] ${n} linhas (planilha → DSQL)`);
}

async function importAutuacoes(pool) {
  const file = path.join(portalRoot, "assets", "data", "autuacoes", "dados.json");
  const payload = readJson(file);
  if (!payload) {
    console.warn("[autuacoes] JSON não encontrado");
    return;
  }
  await upsertSnapshot(pool, "autuacoes_snapshot", payload);
  const n = payload.data?.length || payload.total || 0;
  console.log(`[autuacoes] ${n} linhas (planilha → DSQL)`);
}

async function importFolha(pool) {
  const file = path.join(portalRoot, "assets", "data", "folha-servico", "todos.json");
  const payload = readJson(file);
  if (!payload) {
    console.warn("[folha] JSON não encontrado");
    return;
  }
  await upsertSnapshot(pool, "folha_snapshot", payload);
  const n = payload.dados?.length || payload.total || 0;
  console.log(`[folha] ${n} linhas (planilha → DSQL)`);
}

async function importPontualidade(pool) {
  const dir = path.join(portalRoot, "assets", "data", "pontualidade");
  for (const cenario of ["padrao", "alternativo"]) {
    const file = path.join(dir, `${cenario}.json`);
    const payload = readJson(file);
    if (!payload) continue;
    await upsertPontualidade(pool, cenario, payload);
    const n = payload.dados?.length || payload.total || 0;
    console.log(`[pontualidade/${cenario}] ${n} dias (planilha → DSQL)`);
  }
}

async function importLiberacaoJson(pool) {
  const dir = path.join(portalRoot, "assets", "data", "liberacao");
  const manifest = readJson(path.join(dir, "manifest.json"));
  const dias = manifest?.dias ? Object.keys(manifest.dias).sort() : [];
  const entradas = [];
  for (const dia of dias) {
    const arquivo = manifest.dias[dia];
    const pack = readJson(path.join(dir, arquivo));
    if (!pack?.dados?.length) continue;
    for (const row of pack.dados) {
      entradas.push({ dataIso: dia, row });
    }
  }
  if (!entradas.length) {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("acompanhamento-dia-") && f.endsWith(".json"));
    for (const f of files) {
      const dia = f.replace("acompanhamento-dia-", "").replace(".json", "");
      const pack = readJson(path.join(dir, f));
      if (!pack?.dados) continue;
      for (const row of pack.dados) entradas.push({ dataIso: dia, row });
    }
  }
  const n = await gravarLiberacaoLinhas(pool, entradas);
  console.log(`[liberacao] ${n} linhas de JSON (planilha → DSQL)`);
}

async function importLiberacaoApi(pool) {
  const { dias } = listarJanelaLiberacao();
  const entradas = [];
  for (const dataIso of dias) {
    console.log(`  API liberação ${dataIso}...`);
    const linhas = await buscarLiberacaoDiaApi(dataIso);
    for (const row of linhas) entradas.push({ dataIso, row });
  }
  const n = await gravarLiberacaoLinhas(pool, entradas);
  console.log(`[liberacao-api] ${n} linhas (API planilha → DSQL)`);
}

async function importLiberacaoHoje(pool) {
  const hoje = isoDataLocal(0);
  const dir = path.join(portalRoot, "assets", "data", "liberacao");
  const file = path.join(dir, `acompanhamento-dia-${hoje}.json`);
  let pack = readJson(file);
  if (!pack?.dados?.length) {
    console.log(`  Buscando API liberação hoje (${hoje})...`);
    const linhas = await buscarLiberacaoDiaApi(hoje);
    pack = { dados: linhas };
  }
  const entradas = (pack.dados || []).map((row) => ({ dataIso: hoje, row }));
  const n = await gravarLiberacaoLinhas(pool, entradas);
  console.log(`[liberacao-hoje] ${n} linhas (${hoje})`);
}

async function main() {
  const selected = process.argv.slice(2).length ? process.argv.slice(2) : JOBS.filter((j) => j !== "liberacao-hoje");
  const pool = createDsqlPool();
  try {
    for (const job of selected) {
      switch (job) {
        case "terminais":
          await importTerminais(pool);
          break;
        case "incidentes":
          await importIncidentes(pool);
          break;
        case "autuacoes":
          await importAutuacoes(pool);
          break;
        case "folha":
          await importFolha(pool);
          break;
        case "pontualidade":
          await importPontualidade(pool);
          break;
        case "liberacao":
          await importLiberacaoJson(pool);
          break;
        case "liberacao-api":
          await importLiberacaoApi(pool);
          break;
        case "liberacao-hoje":
          await importLiberacaoHoje(pool);
          break;
        default:
          console.warn(`Job desconhecido: ${job}`);
      }
    }
    console.log("Planilha → DSQL concluído.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
