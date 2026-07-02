/**
 * Telemetria via Aurora DSQL (API AWS) — leitura e importação acumulada.
 */
import {
  awsFetch,
  awsApiEnabled,
  firebaseIdToken,
  initPortalAwsRuntime
} from "./portal-aws-config.js";

async function authHeaders() {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) throw new Error("API AWS não configurada");
  const headers = {};
  try {
    headers.token = await firebaseIdToken();
  } catch (_) {
    const devKey = typeof window !== "undefined" ? window.PORTAL_DEV_API_KEY : "";
    if (devKey) headers.apiKey = devKey;
    else throw new Error("Sessão expirada");
  }
  return headers;
}

export async function carregarTelemetriaAws(dataDe, dataAte, veiculo) {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ de: dataDe, ate: dataAte });
  if (veiculo) qs.set("veiculo", veiculo);
  return awsFetch(`/telemetria?${qs}`, headers);
}

export async function importarTelemetriaAws(linhas, origemArquivo) {
  const headers = await authHeaders();
  return awsFetch("/telemetria/import", {
    method: "POST",
    body: { linhas, origemArquivo },
    ...headers
  });
}

export async function telemetriaAwsDisponivel() {
  await initPortalAwsRuntime();
  return awsApiEnabled();
}

export async function aguardarAuthTelemetria(tentativas = 40, intervaloMs = 500) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) return false;
  try {
    const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const { app } = await import("./portal-firestore.js");
    const auth = getAuth(app);
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken();
          return true;
        } catch (_) { /* retry abaixo */ }
      }
    }
  } catch (_) { /* retry abaixo */ }
  for (let i = 0; i < tentativas; i++) {
    try {
      await firebaseIdToken();
      return true;
    } catch (_) {
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  }
  return false;
}
