/**
 * Migra dados do Firestore (portal-ciop) para Aurora DSQL — espelho do que está no Firebase.
 *
 * Uso (em backend/):
 *   npm run import:firestore-dsql
 *   npm run import:firestore-dsql -- terminais incidentes liberacao
 *
 * Requer: ~/.config/portal-ciop/serviceAccount.json (ou FIREBASE_SERVICE_ACCOUNT)
 *         backend/.env com DSQL_CLUSTER_ID e DSQL_REGION
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { AuroraDSQLPool } from "@aws/aurora-dsql-node-postgres-connector";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.join(__dirname, "..");
dotenv.config({ path: path.join(portalRoot, "backend", ".env") });

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const DSQL_CLUSTER_ID = process.env.DSQL_CLUSTER_ID || "";
const DSQL_REGION = process.env.DSQL_REGION || process.env.AWS_REGION || "sa-east-1";
const DSQL_USER = process.env.DSQL_USER || "admin";
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

function createPool() {
  if (!DSQL_CLUSTER_ID) throw new Error("Configure DSQL_CLUSTER_ID em backend/.env");
  const host = `${DSQL_CLUSTER_ID}.dsql.${DSQL_REGION}.on.aws`;
  return new AuroraDSQLPool({
    host,
    user: DSQL_USER,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    retry: { maxRetries: 5 }
  });
}

async function upsertSnapshot(pool, table, payload) {
  await pool.query(
    `INSERT INTO ${table} (id, payload, atualizado_em)
     VALUES ('atual', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, atualizado_em = NOW()`,
    [JSON.stringify(payload)]
  );
}

async function upsertPontualidade(pool, cenario, payload) {
  await pool.query(
    `INSERT INTO pontualidade_snapshot (cenario, payload, atualizado_em)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (cenario) DO UPDATE SET payload = EXCLUDED.payload, atualizado_em = NOW()`,
    [cenario, JSON.stringify(payload)]
  );
}

async function importTerminais(pool, db) {
  const snap = await db.collection("terminaisAgora").doc("atual").get();
  if (!snap.exists) {
    console.log("[terminais] vazio no Firestore");
    return;
  }
  const payload = snap.data();
  await pool.query(
    `INSERT INTO terminais_snapshot (id, payload, fonte, atualizado_em)
     VALUES ('atual', $1::jsonb, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       fonte = EXCLUDED.fonte,
       atualizado_em = NOW()`,
    [JSON.stringify(payload), payload.fonte || "firestore"]
  );
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
  const rows = [];
  for (const { dataIso, data } of raw) {
    const rowId = String(data?._row || "").trim();
    if (!rowId) continue;
    const payload = { ...data };
    delete payload._dirty;
    delete payload._syncErro;
    payload.data_iso = payload.data_iso || dataIso;
    rows.push({ data_iso: dataIso, row_id: rowId, payload });
  }
  console.log(`[liberacao] ${rows.length} linhas — gravando em lotes...`);
  let done = 0;
  while (done < rows.length) {
    const chunk = rows.slice(done, done + BATCH_TX);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of chunk) {
        await client.query(
          `INSERT INTO liberacao_linhas (data_iso, row_id, payload, atualizado_por, atualizado_em)
           VALUES ($1::date, $2, $3::jsonb, 'firestore-import', NOW())
           ON CONFLICT (data_iso, row_id) DO UPDATE SET
             payload = EXCLUDED.payload,
             atualizado_em = NOW()`,
          [row.data_iso, row.row_id, JSON.stringify(row.payload)]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    done += chunk.length;
    console.log(`  liberacao: ${done}/${rows.length}`);
    if (done < rows.length) await sleep(200);
  }
}

async function main() {
  const selected = process.argv.slice(2).length ? process.argv.slice(2) : JOBS;
  const db = await initFirestore();
  const pool = createPool();

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
