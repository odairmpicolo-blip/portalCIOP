/**
 * Remove do Firestore coleções já migradas para Aurora DSQL.
 *
 * Mantém: usuarios, avisos, avisosPorUsuario
 *
 * Uso (em backend/):
 *   node scripts/limpar-firestore-aws.mjs              # dry-run (só conta)
 *   node scripts/limpar-firestore-aws.mjs --confirm      # apaga de fato
 *   node scripts/limpar-firestore-aws.mjs --confirm terminais incidentes
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = process.env.PORTAL_ROOT || path.join(__dirname, "..", "..");

const COLECOES_SNAPSHOT = [
  { id: "terminais", path: "terminaisAgora", sub: null },
  { id: "incidentes", path: "incidentesDias", sub: "linhas" },
  { id: "autuacoes", path: "autuacoesDias", sub: "linhas" },
  { id: "folha", path: "folhaServicoDias", sub: "linhas" },
  { id: "liberacao", path: "liberacaoDias", sub: "linhas" },
  { id: "pontualidade", path: "pontualidadeCenarios", sub: "dias" }
];

const MANTER = new Set(["usuarios", "avisos", "avisosPorUsuario"]);

const BATCH = 80;
const PAUSA_MS = 350;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function initFirestore() {
  const candidatos = [
    process.env.FIREBASE_SERVICE_ACCOUNT,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(os.homedir(), ".config", "portal-ciop", "serviceAccount.json"),
    path.join(portalRoot, ".secrets", "serviceAccount.json")
  ].filter(Boolean);
  const saPath = candidatos.find((p) => fs.existsSync(p));
  if (!saPath) {
    throw new Error("Service account não encontrada (~/.config/portal-ciop/serviceAccount.json)");
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(saPath, "utf8")))
    });
  }
  return admin.firestore();
}

async function contarSub(db, paiRef, subNome) {
  let total = 0;
  let last = null;
  for (;;) {
    let q = paiRef.collection(subNome).limit(500);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    total += snap.size;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 500) break;
  }
  return total;
}

async function apagarSub(db, paiRef, subNome, confirm) {
  let apagados = 0;
  for (;;) {
    const snap = await paiRef.collection(subNome).limit(BATCH).get();
    if (snap.empty) break;
    if (confirm) {
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      await sleep(PAUSA_MS);
    }
    apagados += snap.size;
    if (!confirm) break;
  }
  return apagados;
}

async function processarColecao(db, cfg, confirm) {
  const colRef = db.collection(cfg.path);
  const pais = await colRef.listDocuments();
  let docsPai = pais.length;
  let subDocs = 0;

  if (cfg.sub) {
    for (const pai of pais) {
      subDocs += await contarSub(db, pai, cfg.sub);
    }
  }

  console.log(`[${cfg.id}] ${cfg.path}${cfg.sub ? `/*/${cfg.sub}` : ""}: ${docsPai} doc(s) pai, ${subDocs} subdoc(s)`);

  if (!confirm) return { docsPai, subDocs, apagados: 0 };

  let apagados = 0;
  if (cfg.sub) {
    for (const pai of pais) {
      apagados += await apagarSub(db, pai, cfg.sub, true);
      await pai.delete();
      apagados += 1;
      await sleep(PAUSA_MS);
    }
  } else {
    for (const pai of pais) {
      await pai.delete();
      apagados += 1;
      await sleep(PAUSA_MS);
    }
  }
  console.log(`[${cfg.id}] apagados: ${apagados}`);
  return { docsPai, subDocs, apagados };
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const filtro = args.filter((a) => !a.startsWith("--"));
  const alvos = filtro.length
    ? COLECOES_SNAPSHOT.filter((c) => filtro.includes(c.id))
    : COLECOES_SNAPSHOT;

  if (!alvos.length) {
    console.error("Nenhuma coleção válida. Opções:", COLECOES_SNAPSHOT.map((c) => c.id).join(", "));
    process.exit(1);
  }

  console.log(confirm ? "=== LIMPEZA Firestore (CONFIRM) ===" : "=== DRY-RUN (use --confirm para apagar) ===");
  console.log("Mantidos:", [...MANTER].join(", "));
  console.log("Alvos:", alvos.map((c) => c.id).join(", "));
  console.log("");

  const db = initFirestore();
  let totalApagados = 0;

  for (const cfg of alvos) {
    const r = await processarColecao(db, cfg, confirm);
    totalApagados += r.apagados || 0;
  }

  console.log("");
  if (confirm) {
    console.log(`Limpeza concluída. Documentos removidos (aprox.): ${totalApagados}`);
  } else {
    console.log("Dry-run concluído. Rode com --confirm para executar a limpeza.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
