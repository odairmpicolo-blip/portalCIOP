/**
 * Importa a janela de liberação (7 dias + hoje + amanhã) da API/planilha para o Firestore.
 *
 * Uso:
 *   npm install firebase-admin
 *   npm run import-liberacao-firestore
 *
 * Autenticação (nesta ordem):
 *   1. FIREBASE_SERVICE_ACCOUNT ou GOOGLE_APPLICATION_CREDENTIALS
 *   2. Sessão do Firebase CLI (npx firebase login)
 *
 * Opcional: LIBERACAO_DIAS_JANELA=7  LIBERACAO_API_URL=...
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getAccessToken } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 180000);
const DIAS_JANELA = Number(process.env.LIBERACAO_DIAS_JANELA || 7);
const PORTAL_TZ = process.env.PORTAL_TZ || "America/Sao_Paulo";
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const LIBERACAO_URL = process.env.LIBERACAO_API_URL
  || process.env.FOLHA_SERVICO_API_URL
  || "https://script.google.com/macros/s/AKfycby9hpIGulGYxlm_Oseasi_D2GIaLSvusFNqcgrSj7l7HwxcUXLTPqd8kX1JxwkCx9lqOA/exec";
const COLECAO = "liberacaoDias";
const SUB = "linhas";
const BATCH_SIZE = 400;

function partesDataPortal(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);
  const get = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day"))
  };
}

function isoDataLocal(offsetDias = 0) {
  const { year, month, day } = partesDataPortal(new Date());
  const d = new Date(Date.UTC(year, month - 1, day + offsetDias));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function listarJanelaImportacao() {
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

function normalizarDataIsoRow(row, fallback) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return fallback;
}

function sanitizarLinha(row, dataIso) {
  const id = String(row?._row || "").trim();
  if (!id) return null;
  const copia = Object.assign({}, row);
  delete copia._dirty;
  delete copia._syncErro;
  copia._row = Number(id) || id;
  copia.data_iso = normalizarDataIsoRow(copia, dataIso);
  copia.importadoEm = new Date().toISOString();
  copia.origem = "planilha";
  return copia;
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ao acessar ${url}`);
  return response.json();
}

async function buscarDiaPlanilha(dataIso) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "acompanhamento",
    data: dataIso,
    limit: "0",
    vivo: "1",
    _: String(Date.now())
  })}`;
  const res = await fetchJson(url);
  if (!res.ok) throw new Error(res.erro || `Falha ao buscar ${dataIso}`);
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
    const id = String(payload._row);
    const ref = adminDb.collection(COLECAO).doc(dataIso).collection(SUB).doc(id);
    batch.set(ref, payload, { merge: true });
    ops++;
    total++;
    if (ops >= BATCH_SIZE) await commitBatch();
  }
  await commitBatch();

  await adminDb.collection(COLECAO).doc(dataIso).set({
    data: dataIso,
    total,
    importadoEm: FieldValue.serverTimestamp(),
    origem: "import-planilha"
  }, { merge: true });

  return total;
}

async function inicializarFirestore() {
  const candidatos = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(os.homedir(), ".config", "portal-ciop", "serviceAccount.json"),
    path.join(process.cwd(), ".secrets", "serviceAccount.json")
  ].filter(Boolean);
  const saPath = candidatos.find((p) => fs.existsSync(p));
  if (saPath) {
    let adminMod;
    try {
      adminMod = await import("firebase-admin");
    } catch (_) {
      console.error("Instale firebase-admin: npm install firebase-admin");
      process.exit(1);
    }
    const admin = adminMod.default;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8"))),
        projectId: PROJECT_ID
      });
    }
    return {
      adminDb: admin.firestore(),
      FieldValue: admin.firestore.FieldValue,
      origemAuth: `service-account (${path.basename(saPath)})`
    };
  }

  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  if (!fs.existsSync(configPath)) {
    console.error(
      "Credenciais ausentes. Opções:\n" +
      "  1. Salve a service account em ~/.config/portal-ciop/serviceAccount.json\n" +
      "  2. FIREBASE_SERVICE_ACCOUNT=/caminho/serviceAccount.json npm run import-liberacao-firestore\n" +
      "  3. GitHub Actions → Importar liberação Firestore (secret FIREBASE_SERVICE_ACCOUNT)\n" +
      "  4. npx firebase login (pode falhar em escrita — prefira service account)"
    );
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const refreshToken = config?.tokens?.refresh_token;
  if (!refreshToken) {
    console.error("Sessão Firebase CLI expirada. Execute: npx firebase login --reauth");
    process.exit(1);
  }

  const authScopes = config?.tokens?.scopes?.length
    ? config.tokens.scopes
    : [scopes.CLOUD_PLATFORM];
  const tokens = await getAccessToken(refreshToken, authScopes);
  if (!tokens?.access_token) {
    console.error("Sessão Firebase CLI expirada. Execute: npx firebase login --reauth");
    process.exit(1);
  }

  const { OAuth2Client } = await import("google-auth-library");
  const { Firestore, FieldValue } = await import("@google-cloud/firestore");
  const oauth2 = new OAuth2Client();
  oauth2.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expires_at
  });

  return {
    adminDb: new Firestore({ projectId: PROJECT_ID, authClient: oauth2 }),
    FieldValue,
    origemAuth: `firebase-cli (${config.user?.email || "usuário logado"})`
  };
}

async function main() {
  const { adminDb, FieldValue, origemAuth } = await inicializarFirestore();
  console.log(`Firestore autenticado via ${origemAuth}.`);

  const { dataDe, dataAte, dias } = listarJanelaImportacao();
  console.log(`Importando liberação ${dataDe} → ${dataAte} (${dias.length} dia(s))...`);

  let totalGeral = 0;
  for (const dataIso of dias) {
    console.log(`  Baixando ${dataIso}...`);
    const linhas = await buscarDiaPlanilha(dataIso);
    console.log(`  Gravando ${linhas.length} linha(s) em Firestore...`);
    const gravadas = await gravarDiaFirestore(adminDb, FieldValue, dataIso, linhas);
    totalGeral += gravadas;
    console.log(`  OK ${dataIso}: ${gravadas} linha(s)`);
  }

  console.log(`Concluído. ${totalGeral} linha(s) na janela.`);
}

main().catch((err) => {
  if (err?.code === 7 || /PERMISSION_DENIED/i.test(String(err?.message || err?.details || ""))) {
    console.error(
      "\nEscrita negada no Firestore. A importação exige service account (Admin SDK).\n" +
      "Firebase Console → Configurações → Contas de serviço → Gerar nova chave privada.\n" +
      "Salve em ~/.config/portal-ciop/serviceAccount.json e rode de novo."
    );
  }
  console.error(err);
  process.exit(1);
});
