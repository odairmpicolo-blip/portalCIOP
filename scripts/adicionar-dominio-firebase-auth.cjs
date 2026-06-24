/**
 * Adiciona portalciop.com.br aos domínios autorizados do Firebase Auth.
 * Usa credenciais do Firebase CLI (firebase login).
 * Uso: node scripts/adicionar-dominio-firebase-auth.cjs
 */
const { getAccessToken, getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const scopes = require("firebase-tools/lib/scopes");

const projectId = process.env.FIREBASE_PROJECT_ID || "portal-ciop";
const domain = process.env.PORTAL_DOMAIN || "portalciop.com.br";

async function main() {
  const account = getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    console.error("Firebase CLI não autenticado. Rode: firebase login");
    process.exit(1);
  }

  const authScopes = account.tokens.scopes || [scopes.CLOUD_PLATFORM];
  const tokenObj = await getAccessToken(account.tokens.refresh_token, authScopes);
  const token = tokenObj?.access_token;
  if (!token) {
    console.error("Não foi possível obter access token. Rode: firebase login --reauth");
    process.exit(1);
  }

  const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const getRes = await fetch(base, {
    headers: { Authorization: `Bearer ${token}` }
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
    console.log("Domínios:", [...domains].join(", "));
    return;
  }

  domains.add(domain);
  const patchRes = await fetch(`${base}?updateMask=authorizedDomains`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
