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
