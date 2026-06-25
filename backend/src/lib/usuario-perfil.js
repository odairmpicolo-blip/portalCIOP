import fs from "node:fs";
import admin from "firebase-admin";
import { config } from "../config.js";

const BOOTSTRAP_GESTOR = new Set([
  "admin@ciop.com.br",
  "supervisor@ciop.com.br",
  "odair.marin@icloud.com"
]);

const PERFIS_POSTAR_AVISO = new Set([
  "Administrador",
  "Supervisor",
  "Gerência",
  "Gerencia",
  "Secretária",
  "Secretaria"
]);

function initFirebaseAdmin() {
  if (admin.apps.length) return true;
  const credPath = config.firebaseCredentials;
  if (!credPath || !fs.existsSync(credPath)) return false;
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8")))
  });
  return true;
}

export async function buscarPerfilUsuario(email) {
  const normalizado = String(email || "").trim().toLowerCase();
  if (!normalizado || normalizado === "api-key") return "";
  if (!initFirebaseAdmin()) return "";
  try {
    const snap = await admin.firestore().collection("usuarios").doc(normalizado).get();
    return snap.exists ? String(snap.data()?.perfil || "").trim() : "";
  } catch (_) {
    return "";
  }
}

export function podePostarAviso(email, perfil) {
  const e = String(email || "").trim().toLowerCase();
  if (BOOTSTRAP_GESTOR.has(e)) return true;
  return PERFIS_POSTAR_AVISO.has(String(perfil || "").trim());
}
