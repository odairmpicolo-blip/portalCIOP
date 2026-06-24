/**
 * Adiciona portalciop.com.br aos domínios autorizados do Firebase Auth.
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=../.secrets/serviceAccount.json node scripts/adicionar-dominio-firebase-auth.mjs
 */
import { GoogleAuth } from "google-auth-library";

const projectId = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const domain = process.env.PORTAL_DOMAIN || "portalciop.com.br";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});
const client = await auth.getClient();
const token = await client.getAccessToken();
const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;

const getRes = await fetch(base, {
  headers: { Authorization: `Bearer ${token.token}` }
});
const text = await getRes.text();
if (!getRes.ok) {
  console.error("Falha ao ler config:", getRes.status, text.slice(0, 500));
  process.exit(1);
}

const config = JSON.parse(text);
const domains = new Set(config.authorizedDomains || []);
if (domains.has(domain)) {
  console.log(`Domínio já autorizado: ${domain}`);
  process.exit(0);
}

domains.add(domain);
const patchRes = await fetch(`${base}?updateMask=authorizedDomains`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token.token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ authorizedDomains: [...domains] })
});
const patchText = await patchRes.text();
if (!patchRes.ok) {
  console.error("Falha ao atualizar:", patchRes.status, patchText.slice(0, 500));
  process.exit(1);
}

console.log(`Domínio adicionado: ${domain}`);
console.log("Domínios atuais:", [...domains].join(", "));
