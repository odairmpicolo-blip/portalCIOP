/**
 * Telemetria via Aurora DSQL (API AWS) — leitura e importação acumulada.
 */
import {
  awsFetch,
  awsApiEnabled,
  firebaseIdToken,
  initPortalAwsRuntime
} from "./portal-aws-config.js";

function erroAuth(msg) {
  return /401|403|token|inválido|invalid|expirad|ausente|unauthorized/i.test(String(msg || ""));
}

async function authHeaders(forceRefresh = false) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) throw new Error("API AWS não configurada");
  const headers = {};
  try {
    headers.token = await firebaseIdToken({ forceRefresh });
  } catch (_) {
    const devKey = typeof window !== "undefined" ? window.PORTAL_DEV_API_KEY : "";
    if (devKey) headers.apiKey = devKey;
    else throw new Error("Sessão expirada — faça login novamente");
  }
  return headers;
}

async function telemetriaFetch(path, options = {}) {
  let ultimoErro = "erro na API";
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const headers = await authHeaders(tentativa > 0);
      return await awsFetch(path, { ...options, ...headers });
    } catch (err) {
      ultimoErro = err.message || ultimoErro;
      if (erroAuth(ultimoErro) && tentativa < 2) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
  throw new Error(ultimoErro);
}

export async function carregarTelemetriaAws(dataDe, dataAte, veiculo) {
  const qs = new URLSearchParams({ de: dataDe, ate: dataAte });
  if (veiculo) qs.set("veiculo", veiculo);
  return telemetriaFetch(`/telemetria?${qs}`);
}

export async function importarTelemetriaAws(linhas, origemArquivo, onProgress) {
  const LOTE = 150;
  let inseridos = 0;
  let unificados = 0;
  const totalLotes = Math.ceil(linhas.length / LOTE) || 1;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const loteNum = Math.floor(i / LOTE) + 1;
    onProgress?.(loteNum, totalLotes, linhas.length);
    const pedaco = linhas.slice(i, i + LOTE);
    const res = await telemetriaFetch("/telemetria/import", {
      method: "POST",
      body: { linhas: pedaco, origemArquivo }
    });
    inseridos += res.inseridos || 0;
    unificados += res.unificados || pedaco.length;
  }
  return { ok: true, inseridos, unificados, total: linhas.length };
}

export async function telemetriaAwsDisponivel() {
  await initPortalAwsRuntime();
  return awsApiEnabled();
}

export async function aguardarAuthTelemetria(tentativas = 12, intervaloMs = 300) {
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
          await auth.currentUser.getIdToken(true);
          return true;
        } catch (_) { /* retry abaixo */ }
      }
    }
  } catch (_) { /* retry abaixo */ }
  for (let i = 0; i < tentativas; i++) {
    try {
      await firebaseIdToken({ forceRefresh: i === 0 });
      return true;
    } catch (_) {
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  }
  return false;
}
