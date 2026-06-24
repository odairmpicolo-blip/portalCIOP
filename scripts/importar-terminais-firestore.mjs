/**
 * Importa snapshot de Terminais Agora (JSON local) para o Firestore.
 * Fluxo somente leitura no portal — escrita via Admin SDK.
 *
 * Uso:
 *   npm run import-terminais-firestore
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const COLECAO = "terminaisAgora";
const DOC_ID = "atual";
const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const SNAPSHOT_JSON = path.join(portalRoot, "assets", "data", "terminais-agora.json");

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
  if (!fs.existsSync(SNAPSHOT_JSON)) {
    console.error("Arquivo não encontrado:", SNAPSHOT_JSON);
    process.exit(1);
  }
  const payload = JSON.parse(fs.readFileSync(SNAPSHOT_JSON, "utf8"));
  const { adminDb, FieldValue } = await inicializarFirestore();
  await adminDb.collection(COLECAO).doc(DOC_ID).set({
    ...payload,
    importadoEm: FieldValue.serverTimestamp(),
    origem: "import-terminais"
  }, { merge: true });
  console.log(`Concluído: ${payload.totalRegistros || payload.REGISTROS?.length || 0} registro(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
