/**
 * Telemetria — planilha Google (Apps Script) com fallback para JSON estático (GitHub Pages).
 */
export const TELEMETRIA_DATA_BASE = "../assets/data/telemetria";
export const TELEMETRIA_DADOS_URL = `${TELEMETRIA_DATA_BASE}/dados.json`;
export const TELEMETRIA_MANIFEST_URL = `${TELEMETRIA_DATA_BASE}/manifest.json`;

let telemetriaScriptUrlCache = "";

function runtimeConfigUrls() {
  const urls = [];
  try {
    urls.push(new URL("../data/portal-runtime.json", import.meta.url).href);
  } catch (_) {
    /* import.meta indisponível */
  }
  if (typeof window !== "undefined") {
    const base = window.location.pathname.replace(/\/pages\/.*$/, "").replace(/\/$/, "");
    urls.push(`${base}/assets/data/portal-runtime.json`);
    urls.push("../assets/data/portal-runtime.json");
  }
  return urls;
}

export async function obterUrlTelemetriaScript() {
  if (telemetriaScriptUrlCache) return telemetriaScriptUrlCache;
  if (typeof window !== "undefined" && window.TELEMETRIA_SCRIPT_URL) {
    telemetriaScriptUrlCache = String(window.TELEMETRIA_SCRIPT_URL).trim();
    return telemetriaScriptUrlCache;
  }
  for (const url of runtimeConfigUrls()) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) continue;
      const cfg = await res.json();
      const scriptUrl = String(cfg?.telemetriaScriptUrl || "").trim();
      if (scriptUrl) {
        telemetriaScriptUrlCache = scriptUrl;
        return scriptUrl;
      }
    } catch (_) {
      /* próximo candidato */
    }
  }
  return "";
}

export async function carregarManifestTelemetria() {
  try {
    const res = await fetch(`${TELEMETRIA_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

export async function carregarSnapshotTelemetriaJson() {
  try {
    const res = await fetch(`${TELEMETRIA_DADOS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.dados) || !data.dados.length) return null;
    return data;
  } catch (_) {
    return null;
  }
}

export async function carregarSnapshotTelemetriaPlanilha() {
  const base = await obterUrlTelemetriaScript();
  if (!base) return null;
  const sep = base.includes("?") ? "&" : "?";
  const url = `${base}${sep}fonte=todos`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.dados) || !data.dados.length) return null;
    return { ...data, origem_carregamento: "planilha" };
  } catch (_) {
    return null;
  }
}

/** Planilha ao vivo (Apps Script); se falhar, usa dados.json do repositório. */
export async function carregarSnapshotTelemetria() {
  const planilha = await carregarSnapshotTelemetriaPlanilha();
  if (planilha) return planilha;
  const json = await carregarSnapshotTelemetriaJson();
  if (json) return { ...json, origem_carregamento: "json" };
  return null;
}
