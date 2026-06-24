/**
 * Importa incidentes TCGL (JSON local) para o Firestore.
 * Fluxo somente leitura no portal — escrita via Admin SDK.
 *
 * Uso:
 *   npm run import-incidentes-firestore
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const COLECAO = "incidentesDias";
const SUB = "linhas";
const BATCH_SIZE = 100;
const PAUSA_MS = 350;
const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const SNAPSHOT_JSON = path.join(portalRoot, "assets", "data", "incidentes-tcgl.json");

function normalizarDataIso(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(br) ? br.slice(0, 10) : "";
}

function idIncidente(row) {
  return String(row?.incidentId || row?.id || "").trim();
}

function sanitizarLinha(row, dataIso) {
  const id = idIncidente(row);
  if (!id) return null;
  const copia = Object.assign({}, row);
  copia.incidentId = id;
  copia.id = String(copia.id || id);
  copia.data_iso = normalizarDataIso(copia) || dataIso;
  copia.importadoEm = new Date().toISOString();
  copia.origem = copia.origem || "import";
  return { id, payload: copia };
}

function agruparPorDia(linhas) {
  const mapa = new Map();
  for (const row of linhas) {
    const dataIso = normalizarDataIso(row);
    if (!dataIso) continue;
    if (!mapa.has(dataIso)) mapa.set(dataIso, []);
    mapa.get(dataIso).push(row);
  }
  return mapa;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function commitBatchComRetry(batch, ops) {
  if (ops === 0) return;
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    try {
      await batch.commit();
      await sleep(PAUSA_MS);
      return;
    } catch (err) {
      const msg = String(err?.message || err);
      if (tentativa >= 7 || !/RESOURCE_EXHAUSTED|quota|429|DEADLINE/i.test(msg)) throw err;
      const espera = Math.min(30000, 1000 * (2 ** tentativa));
      console.warn(`Firestore limitado — aguardando ${espera}ms (tentativa ${tentativa + 1})...`);
      await sleep(espera);
    }
  }
}

async function gravarDiaFirestore(adminDb, FieldValue, dataIso, linhas) {
  let batch = adminDb.batch();
  let ops = 0;
  let total = 0;
  const commitBatch = async () => {
    if (ops === 0) return;
    await commitBatchComRetry(batch, ops);
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
      origem: "import-incidentes"
    }, { merge: true });
  }
  return total;
}

async function main() {
  if (!fs.existsSync(SNAPSHOT_JSON)) {
    console.error("Arquivo não encontrado:", SNAPSHOT_JSON);
    process.exit(1);
  }
  const { adminDb, FieldValue } = await inicializarFirestore();
  const payload = JSON.parse(fs.readFileSync(SNAPSHOT_JSON, "utf8"));
  const linhas = payload.incidentes || [];
  console.log(`Importando ${linhas.length} incidente(s)...`);
  let total = 0;
  let dias = 0;
  for (const [dataIso, regs] of agruparPorDia(linhas)) {
    dias++;
    total += await gravarDiaFirestore(adminDb, FieldValue, dataIso, regs);
    if (dias % 20 === 0) console.log(`Progresso: ${total} linha(s) em ${dias} dia(s)...`);
  }
  console.log(`Concluído: ${total} linha(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
