/**
 * Importa autuações (JSON local + janela recente da planilha) para o Firestore.
 * Fluxo somente leitura no portal — escrita via Admin SDK.
 *
 * Uso:
 *   npm run import-autuacoes-firestore
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 180000);
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const AUTUACOES_URL = process.env.AUTUACOES_API_URL
  || "https://script.google.com/macros/s/AKfycbylz8scwboPQLeOKWUpw9YqKxomjts1aa8KUwodAuq5IE3T9s7RXd6GJcfMnS9qu6DI/exec";
const AUTUACOES_DATA_DE = process.env.AUTUACOES_DATA_DE || "2015-01-01";
const COLECAO = "autuacoesDias";
const SUB = "linhas";
const BATCH_SIZE = 400;
const IMPORT_LOCAL = String(process.env.AUTUACOES_IMPORT_LOCAL || "1") !== "0";
const JANELA_DIAS = Number(process.env.AUTUACOES_IMPORT_JANELA || 14);
const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const SNAPSHOT_JSON = path.join(portalRoot, "assets", "data", "autuacoes", "dados.json");

function isoHoje() {
  return new Date().toISOString().slice(0, 10);
}

function isoDiasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

function normalizarDataIsoRow(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data_br || row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(br) ? br.slice(0, 10) : "";
}

function idLinhaAutuacao(row, dataIso) {
  const ordem = String(row?.ordem ?? "").trim();
  if (ordem) return ordem;
  return [
    normalizarDataIsoRow(row) || dataIso || "",
    row?.notificacao || "",
    row?.auto || ""
  ].join("_").replace(/[^\w.-]+/g, "_").slice(0, 120) || "sem-id";
}

function sanitizarLinha(row, dataIso) {
  const id = idLinhaAutuacao(row, dataIso);
  if (!id) return null;
  const copia = Object.assign({}, row);
  copia.ordem = copia.ordem ?? id;
  copia.data_iso = normalizarDataIsoRow(copia) || dataIso;
  if (!copia.data_br && copia.data_iso) {
    const [y, m, d] = copia.data_iso.split("-");
    copia.data_br = `${d}/${m}/${y}`;
  }
  copia.importadoEm = new Date().toISOString();
  copia.origem = copia.origem || "import";
  return { id, payload: copia };
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (/^\s*</.test(text)) throw new Error("Resposta HTML da API.");
  return JSON.parse(text);
}

async function buscarPlanilha(dataDe, dataAte, completo = "0") {
  const url = `${AUTUACOES_URL}?${new URLSearchParams({
    data_de: dataDe,
    data_ate: dataAte,
    completo,
    _: String(Date.now())
  })}`;
  const payload = await fetchJson(url);
  if (payload.status === "error") throw new Error(payload.message || "Erro na API");
  return payload.data || payload.dados || [];
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
    const item = sanitizarLinha(row, dataIso);
    if (!item) continue;
    batch.set(
      adminDb.collection(COLECAO).doc(dataIso).collection(SUB).doc(item.id),
      item.payload,
      { merge: true }
    );
    ops++;
    total++;
    if (ops >= BATCH_SIZE) await commitBatch();
  }
  await commitBatch();

  if (total > 0) {
    await adminDb.collection(COLECAO).doc(dataIso).set({
      data: dataIso,
      total,
      importadoEm: FieldValue.serverTimestamp(),
      origem: "import-autuacoes"
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

  if (IMPORT_LOCAL && fs.existsSync(SNAPSHOT_JSON)) {
    console.log("Importando dados.json...");
    const payload = JSON.parse(fs.readFileSync(SNAPSHOT_JSON, "utf8"));
    const linhas = payload.data || payload.dados || [];
    for (const [dataIso, regs] of agruparPorDia(linhas)) {
      total += await gravarDiaFirestore(adminDb, FieldValue, dataIso, regs);
    }
  }

  console.log(`Importando janela ${JANELA_DIAS} dias da planilha...`);
  const dataDe = isoDiasAtras(JANELA_DIAS);
  const dataAte = isoHoje();
  try {
    const recentes = await buscarPlanilha(dataDe, dataAte, "0");
    for (const [dataIso, regs] of agruparPorDia(recentes)) {
      total += await gravarDiaFirestore(adminDb, FieldValue, dataIso, regs);
    }
  } catch (err) {
    console.warn("Planilha recente:", err.message);
  }

  console.log(`Concluído: ${total} linha(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
