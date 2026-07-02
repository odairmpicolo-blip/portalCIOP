import fs from "node:fs";
import admin from "firebase-admin";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";

let firebaseReady = false;
const oauthClient = new OAuth2Client();

function initFirebaseAdmin() {
  if (firebaseReady || admin.apps.length) {
    firebaseReady = true;
    return true;
  }
  const credPath = config.firebaseCredentials;
  if (!credPath || !fs.existsSync(credPath)) return false;
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8")))
  });
  firebaseReady = true;
  return true;
}

async function verifyFirebaseToken(token) {
  if (initFirebaseAdmin()) {
    const decoded = await admin.auth().verifyIdToken(token);
    return { email: decoded.email, uid: decoded.uid };
  }
  const ticket = await oauthClient.verifyIdToken({
    idToken: token,
    audience: config.firebaseProjectId,
    clockTolerance: 120
  });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("Token sem e-mail");
  const issOk = !payload.iss || payload.iss === `https://securetoken.google.com/${config.firebaseProjectId}`;
  if (!issOk) throw new Error("Emissor do token inválido");
  return { email: payload.email, uid: payload.sub };
}

export function requireApiKey(req, res, next) {
  const key = req.get("X-Portal-Api-Key") || "";
  if (!config.apiKey || key !== config.apiKey) {
    res.status(401).json({ ok: false, erro: "API key inválida" });
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
    res.status(401).json({ ok: false, erro: "Token ausente" });
    return;
  }

  try {
    req.user = await verifyFirebaseToken(token);
    next();
  } catch (err) {
    const msg = String(err?.message || "");
    const erro = /expired|expir/i.test(msg) ? "Token expirado" : "Token inválido";
    console.warn("auth:", erro, msg.slice(0, 120));
    res.status(401).json({ ok: false, erro });
  }
}
