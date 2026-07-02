/**
 * Telemetria via Aurora DSQL (API AWS) — leitura e importação acumulada.
 */
import {
  awsFetch,
  awsApiEnabled,
  initPortalAwsRuntime
} from "./portal-aws-config.js";
import { app } from "./portal-firestore.js";

function erroAuth(msg) {
  return /401|403|token|inválido|invalid|expirad|ausente|unauthorized|sessão|sessao/i.test(String(msg || ""));
}

async function obterTokenFirebase(forceRefresh = false) {
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const auth = getAuth(app);
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Sessão expirada — saia e entre novamente no portal");
  }
  return user.getIdToken(forceRefresh);
}

async function authHeaders(forceRefresh = false) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) throw new Error("API AWS não configurada");
  const token = await obterTokenFirebase(forceRefresh);
  return { token };
}

async function telemetriaFetch(path, options = {}) {
  let ultimoErro = "erro na API";
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      const headers = await authHeaders(tentativa > 0);
      return await awsFetch(path, { ...options, ...headers });
    } catch (err) {
      ultimoErro = err.message || ultimoErro;
      if (erroAuth(ultimoErro) && tentativa < 4) {
        await new Promise((r) => setTimeout(r, 350 + tentativa * 250));
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

export async function aguardarAuthTelemetria(tentativas = 20, intervaloMs = 250) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) return false;
  for (let i = 0; i < tentativas; i++) {
    try {
      await obterTokenFirebase(i === 0 || i % 4 === 0);
      return true;
    } catch (_) {
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  }
  return false;
}

export async function renovarSessaoTelemetria() {
  try {
    await obterTokenFirebase(true);
    return true;
  } catch (_) {
    return false;
  }
}
