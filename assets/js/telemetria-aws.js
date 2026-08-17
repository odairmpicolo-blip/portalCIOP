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

const LOTE_PADRAO = 35;
const LOTE_GRANDE = 20;
const LOTE_MINIMO = 5;
const PAUSA_ENTRE_LOTES_MS = 150;

function tamanhoLoteImportacao(totalLinhas) {
  if (totalLinhas > 2000) return LOTE_GRANDE;
  if (totalLinhas > 800) return LOTE_PADRAO;
  return 80;
}

function pausar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function importarLoteTelemetria(lote, origemArquivo) {
  return telemetriaFetch("/telemetria/import", {
    method: "POST",
    body: { linhas: lote, origemArquivo }
  });
}

async function importarLoteComRetry(lote, origemArquivo, tentativa = 0) {
  try {
    return await importarLoteTelemetria(lote, origemArquivo);
  } catch (err) {
    if (lote.length > LOTE_MINIMO && tentativa < 4) {
      await pausar(400 + tentativa * 350);
      const meio = Math.ceil(lote.length / 2);
      const esq = await importarLoteComRetry(lote.slice(0, meio), origemArquivo, tentativa + 1);
      const dir = await importarLoteComRetry(lote.slice(meio), origemArquivo, tentativa + 1);
      return {
        inseridos: (esq.inseridos || 0) + (dir.inseridos || 0),
        unificados: (esq.unificados || 0) + (dir.unificados || 0)
      };
    }
    throw err;
  }
}

export async function importarTelemetriaAws(linhas, origemArquivo, onProgress) {
  const LOTE = tamanhoLoteImportacao(linhas.length);
  let inseridos = 0;
  let unificados = 0;
  const totalLotes = Math.ceil(linhas.length / LOTE) || 1;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const loteNum = Math.floor(i / LOTE) + 1;
    onProgress?.(loteNum, totalLotes, linhas.length);
    const pedaco = linhas.slice(i, i + LOTE);
    const res = await importarLoteComRetry(pedaco, origemArquivo);
    inseridos += res.inseridos || 0;
    unificados += res.unificados || pedaco.length;
    if (i + LOTE < linhas.length) await pausar(PAUSA_ENTRE_LOTES_MS);
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
