/**
 * Importa folha de serviço (JSON local + janela recente da planilha) para o Firestore.
 *
 * Uso:
 *   npm install firebase-admin
 *   npm run import-folha-servico-firestore
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getAccessToken } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 180000);
const PORTAL_TZ = process.env.PORTAL_TZ || "America/Sao_Paulo";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const FOLHA_URL = process.env.FOLHA_SERVICO_API_URL
  || "https://script.google.com/macros/s/AKfycby9hpIGulGYxlm_Oseasi_D2GIaLSvusFNqcgrSj7l7HwxcUXLTPqd8kX1JxwkCx9lqOA/exec";
const COLECAO = "folhaServicoDias";
const SUB = "linhas";
const BATCH_SIZE = 400;
const IMPORT_LOCAL = String(process.env.FOLHA_IMPORT_LOCAL || "1") !== "0";
const JANELA_DIAS = Number(process.env.FOLHA_IMPORT_JANELA || 14);
const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const FOLHA_TODOS_JSON = path.join(portalRoot, "assets", "data", "folha-servico", "todos.json");

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

function listarJanelaDias(deOffset, ateOffset) {
  const dias = [];
  for (let n = deOffset; n <= ateOffset; n++) dias.push(isoDataLocal(n));
  return dias;
}

function normalizarDataIsoRow(row, fallback) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(br) ? br : fallback;
}

function sanitizarLinha(row, dataIso) {
  const id = String(row?._row || "").trim();
  if (!id) return null;
  const copia = Object.assign({}, row);
  delete copia._dirty;
  copia._row = Number(id) || id;
  copia.data_iso = normalizarDataIsoRow(copia, dataIso);
  if (!copia.data && dataIso) copia.data = dataIso;
  copia.importadoEm = new Date().toISOString();
  copia.origem = copia.origem || "import";
  return copia;
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (/^\s*</.test(text)) throw new Error("Resposta HTML da API.");
  const payload = JSON.parse(text);
  if (payload?.ok === false) throw new Error(payload.erro || "Resposta inválida da API.");
  return payload;
}

async function buscarDiaPlanilha(dataIso) {
  const url = `${FOLHA_URL}?${new URLSearchParams({ data: dataIso, _: String(Date.now()) })}`;
  const res = await fetchJson(url);
  if (!res.ok) throw new Error(res.erro || `Falha ${dataIso}`);
  return res.dados || [];
}

async function gravarDiaFirestore(adminDb, FieldValue, dataIso, linhas) {
  let batch = adminDb.batch();
  let ops = 0;
  let total = 0;
  const commitBatch = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = adminDb.batch();
    ops = 0;
  };
  for (const row of linhas) {
    const payload = sanitizarLinha(row, dataIso);
    if (!payload) continue;
    batch.set(adminDb.collection(COLECAO).doc(dataIso).collection(SUB).doc(String(payload._row)), payload, { merge: true });
    ops++;
    total++;
    if (ops >= BATCH_SIZE) await commitBatch();
  }
  await commitBatch();
  if (total > 0) {
    await adminDb.collection(COLECAO).doc(dataIso).set({
      data: dataIso, total, importadoEm: FieldValue.serverTimestamp(), origem: "import-folha"
    }, { merge: true });
  }
  return total;
}

async function inicializarFirestore() {
  const candidatos = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(os.homedir(), ".config", "portal-ciop", "serviceAccount.json")
  ].filter(Boolean);
  const saPath = candidatos.find((p) => fs.existsSync(p));
  if (!saPath) {
    console.error("Configure service account em ~/.config/portal-ciop/serviceAccount.json");
    process.exit(1);
  }
  const adminMod = await import("firebase-admin");
  const admin = adminMod.default;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
      projectId: PROJECT_ID
    });
  }
  return { adminDb: admin.firestore(), FieldValue: admin.firestore.FieldValue };
}

function agruparPorDia(linhas) {
  const mapa = new Map();
  for (const row of linhas) {
    const dataIso = normalizarDataIsoRow(row);
    if (!dataIso) continue;
    if (!mapa.has(dataIso)) mapa.set(dataIso, []);
    mapa.get(dataIso).push(row);
  }
  return mapa;
}

async function main() {
  const { adminDb, FieldValue } = await inicializarFirestore();
  let total = 0;
  if (IMPORT_LOCAL && fs.existsSync(FOLHA_TODOS_JSON)) {
    console.log("Importando todos.json...");
    const payload = JSON.parse(fs.readFileSync(FOLHA_TODOS_JSON, "utf8"));
    for (const [dataIso, regs] of agruparPorDia(payload.dados || [])) {
      total += await gravarDiaFirestore(adminDb, FieldValue, dataIso, regs);
    }
  }
  console.log(`Importando janela ${JANELA_DIAS} dias da planilha...`);
  for (const dataIso of listarJanelaDias(-JANELA_DIAS, 0)) {
    try {
      total += await gravarDiaFirestore(adminDb, FieldValue, dataIso, await buscarDiaPlanilha(dataIso));
    } catch (err) {
      console.warn(dataIso, err.message);
    }
  }
  console.log(`Concluído: ${total} linha(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
