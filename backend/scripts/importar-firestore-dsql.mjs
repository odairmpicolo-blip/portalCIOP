/**
 * Migra dados do Firestore (portal-ciop) para Aurora DSQL — espelho do que está no Firebase.
 *
 * Uso (em backend/):
 *   npm run import:firestore-dsql
 *   npm run import:firestore-dsql -- terminais incidentes liberacao
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDsqlPool,
  upsertSnapshot,
  upsertPontualidade,
  upsertTerminais,
  gravarLiberacaoLinhas
} from "./lib/dsql-import.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.join(__dirname, "..", "..");
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const BATCH_TX = 2500;

const JOBS = ["terminais", "incidentes", "autuacoes", "folha", "pontualidade", "liberacao"];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function initFirestore() {
  const candidatos = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(os.homedir(), ".config", "portal-ciop", "serviceAccount.json"),
    path.join(portalRoot, ".secrets", "serviceAccount.json")
  ].filter(Boolean);
  const saPath = candidatos.find((p) => fs.existsSync(p));
  if (!saPath) {
    throw new Error("Service account não encontrada. Salve em ~/.config/portal-ciop/serviceAccount.json");
  }
  const adminMod = await import("firebase-admin");
  const admin = adminMod.default;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
      projectId: PROJECT_ID
    });
  }
  return admin.firestore();
}

async function importTerminais(pool, db) {
  const snap = await db.collection("terminaisAgora").doc("atual").get();
  if (!snap.exists) {
    console.log("[terminais] vazio no Firestore");
    return;
  }
  const payload = snap.data();
  await upsertTerminais(pool, { ...payload, fonte: payload.fonte || "firestore" });
  const n = payload.REGISTROS?.length || payload.totalRegistros || 0;
  console.log(`[terminais] ${n} registros`);
}

async function lerLinhasSubcoleção(db, colecaoDias, sub = "linhas") {
  const diasSnap = await db.collection(colecaoDias).get();
  const linhas = [];
  const docs = diasSnap.docs.sort((a, b) => a.id.localeCompare(b.id));
  const LOTE = 25;
  for (let i = 0; i < docs.length; i += LOTE) {
    const chunk = docs.slice(i, i + LOTE);
    const partes = await Promise.all(
      chunk.map((diaDoc) => db.collection(colecaoDias).doc(diaDoc.id).collection(sub).get())
    );
    partes.forEach((linhasSnap, idx) => {
      const dataIso = chunk[idx].id;
      linhasSnap.forEach((item) => {
        linhas.push({ id: item.id, dataIso, data: item.data() });
      });
    });
    process.stdout.write(`\r  ${Math.min(i + LOTE, docs.length)}/${docs.length} dias`);
  }
  if (docs.length) process.stdout.write("\n");
  return linhas;
}

function normalizarDataIsoIncidente(row, dataIso) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(br) ? br.slice(0, 10) : dataIso;
}

async function importIncidentes(pool, db) {
  console.log("[incidentes] lendo Firestore...");
  const raw = await lerLinhasSubcoleção(db, "incidentesDias");
  const incidentes = raw.map(({ id, dataIso, data }) => {
    const row = { ...data, incidentId: data?.incidentId || data?.id || id, id: data?.id || id };
    row.data_iso = normalizarDataIsoIncidente(row, dataIso);
    return row;
  });
  const payload = {
    incidentes,
    totalExtraido: incidentes.length,
    atualizadoEm: new Date().toISOString(),
    fonte: "Firestore import",
    empresa: "TCGL"
  };
  await upsertSnapshot(pool, "incidentes_snapshot", payload);
  console.log(`[incidentes] ${incidentes.length} linhas`);
}

async function importAutuacoes(pool, db) {
  console.log("[autuacoes] lendo Firestore...");
  const raw = await lerLinhasSubcoleção(db, "autuacoesDias");
  const data = raw.map(({ id, dataIso, data }) => ({
    ...data,
    ordem: data?.ordem ?? id,
    data_iso: data?.data_iso || dataIso
  }));
  const payload = {
    data,
    total: data.length,
    atualizadoEm: new Date().toISOString(),
    fonte: "Firestore import"
  };
  await upsertSnapshot(pool, "autuacoes_snapshot", payload);
  console.log(`[autuacoes] ${data.length} linhas`);
}

async function importFolha(pool, db) {
  console.log("[folha] lendo Firestore...");
  const raw = await lerLinhasSubcoleção(db, "folhaServicoDias");
  const dados = raw.map(({ id, dataIso, data }) => ({
    ...data,
    data_iso: data?.data_iso || dataIso
  }));
  const payload = {
    dados,
    total: dados.length,
    atualizadoEm: new Date().toISOString(),
    fonte: "Firestore import"
  };
  await upsertSnapshot(pool, "folha_snapshot", payload);
  console.log(`[folha] ${dados.length} linhas`);
}

function parsePercent(value) {
  if (value === null || value === undefined || value === "") return 0;
  let text = String(value).trim().replace("%", "").replace(",", ".");
  const n = Number(text);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

async function importPontualidade(pool, db) {
  const cenariosSnap = await db.collection("pontualidadeCenarios").get();
  for (const cenarioDoc of cenariosSnap.docs) {
    const cenario = cenarioDoc.id;
    const diasSnap = await db.collection("pontualidadeCenarios").doc(cenario).collection("dias").get();
    const dados = [];
    diasSnap.forEach((item) => {
      const d = item.data();
      const date = d.date || d.data || item.id;
      if (!date) return;
      dados.push({
        date: String(date).slice(0, 10),
        cenario,
        no_horario: parsePercent(d.no_horario),
        adiantado: parsePercent(d.adiantado),
        atrasado: parsePercent(d.atrasado)
      });
    });
    dados.sort((a, b) => a.date.localeCompare(b.date));
    const payload = {
      cenario,
      dados,
      total: dados.length,
      atualizadoEm: new Date().toISOString(),
      fonte: "Firestore import"
    };
    await upsertPontualidade(pool, cenario, payload);
    console.log(`[pontualidade/${cenario}] ${dados.length} dias`);
  }
}

async function importLiberacao(pool, db) {
  console.log("[liberacao] lendo Firestore...");
  const raw = await lerLinhasSubcoleção(db, "liberacaoDias");
  const entradas = raw
    .filter(({ data }) => String(data?._row || "").trim())
    .map(({ dataIso, data }) => ({ dataIso, row: data }));
  console.log(`[liberacao] ${entradas.length} linhas — gravando em lotes...`);
  let done = 0;
  while (done < entradas.length) {
    const chunk = entradas.slice(done, done + BATCH_TX);
    const n = await gravarLiberacaoLinhas(pool, chunk, { origem: "firestore-import" });
    done += chunk.length;
    console.log(`  liberacao: ${done}/${entradas.length}`);
    if (done < entradas.length) await sleep(200);
  }
}

async function main() {
  const selected = process.argv.slice(2).length ? process.argv.slice(2) : JOBS;
  const db = await initFirestore();
  const pool = createDsqlPool();

  try {
    for (const job of selected) {
      switch (job) {
        case "terminais":
          await importTerminais(pool, db);
          break;
        case "incidentes":
          await importIncidentes(pool, db);
          break;
        case "autuacoes":
          await importAutuacoes(pool, db);
          break;
        case "folha":
          await importFolha(pool, db);
          break;
        case "pontualidade":
          await importPontualidade(pool, db);
          break;
        case "liberacao":
          await importLiberacao(pool, db);
          break;
        default:
          console.warn(`Job desconhecido: ${job}`);
      }
    }
    console.log("Importação Firestore → DSQL concluída.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
