/**
 * Importa pontualidade (JSON local + planilha) para o Firestore.
 * Fluxo somente leitura no portal — escrita via Admin SDK.
 *
 * Uso:
 *   npm run import-pontualidade-firestore
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 180000);
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const COLECAO = "pontualidadeCenarios";
const SUB = "dias";
const BATCH_SIZE = 400;
const IMPORT_LOCAL = String(process.env.PONTUALIDADE_IMPORT_LOCAL || "1") !== "0";
const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const DATA_DIR = path.join(portalRoot, "assets", "data", "pontualidade");

const CENARIOS_URL = {
  padrao: process.env.PONTUALIDADE_PADRAO_URL
    || "https://script.google.com/macros/s/AKfycbwp-s3tzcxQl0gsm20zSfBb7Rw0bQwKnIX0hB9j_nLDIALZKvu3xeGL9G1jo-SSsXhQ9A/exec",
  alternativo: process.env.PONTUALIDADE_ALT_URL
    || "https://script.google.com/macros/s/AKfycbypfszDiFW2RTgoIvnzSYNSHALfCePOINDaFfcViFIcYqXEj3-O9NXsbs-mdRJ2I2jF/exec"
};

function normalizarDataIso(row) {
  const bruto = row?.date || row?.data || row?.data_iso || "";
  const text = String(bruto).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const p = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return "";
}

function parsePercentValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  let text = String(value).trim().replace("%", "").replace(",", ".");
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return number > 1 ? number / 100 : number;
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return null;
}

function normalizarLinha(row, cenario) {
  const date = normalizarDataIso(row);
  if (!date) return null;
  return {
    id: date,
    payload: {
      cenario,
      date,
      no_horario: parsePercentValue(pickValue(row, ["no_horario", "noHorario", "No Horário", "No horario", "NO HORARIO", "Pontualidade", "pontualidade"])),
      adiantado: parsePercentValue(pickValue(row, ["adiantado", "Adiantado", "ADIANTADO"])),
      atrasado: parsePercentValue(pickValue(row, ["atrasado", "Atrasado", "ATRASADO"])),
      importadoEm: new Date().toISOString(),
      origem: "import"
    }
  };
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

async function buscarPlanilha(cenario) {
  const url = `${CENARIOS_URL[cenario]}?${new URLSearchParams({ _: String(Date.now()) })}`;
  const raw = await fetchJson(url);
  return Array.isArray(raw) ? raw : (raw.data || raw.dados || raw.rows || raw.valores || []);
}

async function gravarCenarioFirestore(adminDb, FieldValue, cenario, linhas) {
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
    const item = normalizarLinha(row, cenario);
    if (!item) continue;
    batch.set(
      adminDb.collection(COLECAO).doc(cenario).collection(SUB).doc(item.id),
      item.payload,
      { merge: true }
    );
    ops++;
    total++;
    if (ops >= BATCH_SIZE) await commitBatch();
  }
  await commitBatch();

  if (total > 0) {
    await adminDb.collection(COLECAO).doc(cenario).set({
      cenario,
      total,
      importadoEm: FieldValue.serverTimestamp(),
      origem: "import-pontualidade"
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

async function main() {
  const { adminDb, FieldValue } = await inicializarFirestore();
  let total = 0;

  for (const cenario of Object.keys(CENARIOS_URL)) {
    let linhas = [];
    const jsonPath = path.join(DATA_DIR, `${cenario}.json`);
    if (IMPORT_LOCAL && fs.existsSync(jsonPath)) {
      console.log(`Importando ${cenario}.json...`);
      const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      linhas = payload.dados || payload.data || [];
    }
    console.log(`Atualizando ${cenario} da planilha...`);
    try {
      const planilha = await buscarPlanilha(cenario);
      const mapa = new Map();
      linhas.forEach((row) => {
        const iso = normalizarDataIso(row);
        if (iso) mapa.set(iso, row);
      });
      planilha.forEach((row) => {
        const iso = normalizarDataIso(row);
        if (iso) mapa.set(iso, row);
      });
      linhas = [...mapa.values()];
    } catch (err) {
      console.warn(`${cenario} planilha:`, err.message);
    }
    total += await gravarCenarioFirestore(adminDb, FieldValue, cenario, linhas);
  }

  console.log(`Concluído: ${total} dia(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
