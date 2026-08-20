import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";
import { verificarIdTokenFirebase } from "./firebase-token.js";
import { config } from "../config.js";
import { jsonErro } from "../lib/http.js";

let firebaseReady = false;

function candidatosServiceAccount() {
  return [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    "/var/task/.secrets/serviceAccount.json",
    path.join(process.cwd(), ".secrets", "serviceAccount.json")
  ].filter(Boolean);
}

function carregarServiceAccountJson() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (_) {
      /* ignora JSON inválido */
    }
  }
  const arquivo = candidatosServiceAccount().find((p) => fs.existsSync(p));
  if (!arquivo) return null;
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch (_) {
    return null;
  }
}

function initFirebaseAdmin() {
  if (firebaseReady || admin.apps.length) {
    firebaseReady = true;
    return true;
  }
  const credPath = config.firebaseCredentials;
  if (credPath && fs.existsSync(credPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8"))),
      projectId: config.firebaseProjectId
    });
    firebaseReady = true;
    return true;
  }
  const serviceAccount = carregarServiceAccountJson();
  if (!serviceAccount) return false;
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: config.firebaseProjectId
  });
  firebaseReady = true;
  return true;
}

async function verifyFirebaseToken(token) {
  if (initFirebaseAdmin()) {
    const decoded = await admin.auth().verifyIdToken(token, true);
    return { email: decoded.email, uid: decoded.uid };
  }
  /* Sem credencial de conta de serviço, o caminho certo é conferir a assinatura
     contra as chaves públicas do Firebase. O verificador da google-auth-library que
     estava aqui é para tokens OAuth do Google: ele usa outro conjunto de certificados
     e por isso recusava TODO token do Firebase, com a mensagem "Token inválido".
     Era o motivo de nenhuma página conseguir ler do banco. */
  return verificarIdTokenFirebase(token, { projectId: config.firebaseProjectId });
}

export function requireApiKey(req, res, next) {
  const key = req.get("X-Portal-Api-Key") || "";
  if (!config.apiKey || key !== config.apiKey) {
    jsonErro(res, 401, "API key inválida", "API_KEY");
    return;
  }
  next();
}

export async function requireFirebaseUser(req, res, next) {
  const header = req.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const apiKey = req.get("X-Portal-Api-Key") || "";

  if (!token && config.allowApiKeyRead && req.method === "GET" && apiKey && apiKey === config.apiKey) {
    req.user = { email: "api-key", uid: "api-key" };
    next();
    return;
  }

  if (!token) {
    jsonErro(res, 401, "Token ausente", "TOKEN_AUSENTE");
    return;
  }

  try {
    req.user = await verifyFirebaseToken(token);
    next();
  } catch (err) {
    const msg = String(err?.message || "");
    const erro = /expired|expir/i.test(msg) ? "Token expirado" : "Token inválido";
    console.warn("auth:", erro, msg.slice(0, 160));
    jsonErro(res, 401, erro, erro === "Token expirado" ? "TOKEN_EXPIRADO" : "TOKEN_INVALIDO");
  }
}
