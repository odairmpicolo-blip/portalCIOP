/**
 * Telemetria — planilha Google (Apps Script) com fallback para JSON estático (GitHub Pages).
 */
export const TELEMETRIA_DATA_BASE = "../assets/data/telemetria";
export const TELEMETRIA_DADOS_URL = `${TELEMETRIA_DATA_BASE}/dados.json`;
export const TELEMETRIA_MANIFEST_URL = `${TELEMETRIA_DATA_BASE}/manifest.json`;

const SNAPSHOT_CACHE_KEY = "portal_telemetria_snapshot_v1";
const SNAPSHOT_CACHE_TTL_MS = 15 * 60 * 1000;

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

export function filtrarSnapshotRegistros(snap, { fonte = "todos", de = "", ate = "" } = {}) {
  if (!snap?.dados?.length) return snap;
  let dados = snap.dados;
  if (fonte && fonte !== "todos") {
    dados = dados.filter((d) => (d.fonte || "tcgl") === fonte);
  }
  if (de) dados = dados.filter((d) => d.data_iso && d.data_iso >= de);
  if (ate) dados = dados.filter((d) => d.data_iso && d.data_iso <= ate);
  const clever = dados.filter((d) => (d.fonte || "tcgl") === "clever").length;
  const tcgl = dados.filter((d) => (d.fonte || "tcgl") === "tcgl").length;
  const datas = dados.map((d) => d.data_iso).filter(Boolean).sort();
  return {
    ...snap,
    dados,
    total: dados.length,
    total_clever: clever,
    total_tcgl: tcgl,
    data_de: datas[0] || null,
    data_ate: datas[datas.length - 1] || null
  };
}

function chaveCacheSnapshot({ fonte, de, ate }) {
  return `${fonte || "todos"}|${de || ""}|${ate || ""}`;
}

function lerCacheSnapshot(opcoes) {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry?.snap?.dados?.length) return null;
    if (Date.now() - (entry.salvoEm || 0) > SNAPSHOT_CACHE_TTL_MS) return null;
    if (entry.chave !== chaveCacheSnapshot(opcoes)) return null;
    return { ...entry.snap, origem_carregamento: entry.origem || "cache" };
  } catch (_) {
    return null;
  }
}

function gravarCacheSnapshot(snap, opcoes, origem) {
  if (typeof sessionStorage === "undefined" || !snap?.dados?.length) return;
  try {
    sessionStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify({
      chave: chaveCacheSnapshot(opcoes),
      snap,
      origem,
      salvoEm: Date.now()
    }));
  } catch (_) {
    /* quota */
  }
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

export async function carregarResumoTelemetriaPlanilha() {
  const base = await obterUrlTelemetriaScript();
  if (!base) return null;
  const sep = base.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${base}${sep}resumo=1`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok ? data : null;
  } catch (_) {
    return null;
  }
}

export async function carregarSnapshotTelemetriaPlanilha({ fonte = "todos", de = "", ate = "" } = {}) {
  const opcoes = { fonte, de, ate };
  const cached = lerCacheSnapshot(opcoes);
  if (cached) return cached;

  const base = await obterUrlTelemetriaScript();
  if (!base) return null;
  const params = new URLSearchParams();
  params.set("fonte", fonte || "todos");
  if (de) params.set("de", de);
  if (ate) params.set("ate", ate);
  const sep = base.includes("?") ? "&" : "?";
  const url = `${base}${sep}${params.toString()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.dados) || !data.dados.length) return null;
    const snap = { ...data, origem_carregamento: "planilha" };
    gravarCacheSnapshot(snap, opcoes, "planilha");
    return snap;
  } catch (_) {
    return null;
  }
}

/**
 * JSON local primeiro (rápido), depois planilha com período limitado.
 * @param {{ fonte?: string, de?: string, ate?: string }} opcoes
 */
export async function carregarSnapshotTelemetria(opcoes = {}) {
  const { fonte = "todos", de = "", ate = "" } = opcoes;
  const filtro = { fonte, de, ate };

  const cached = lerCacheSnapshot(filtro);
  if (cached) return cached;

  const json = await carregarSnapshotTelemetriaJson();
  if (json?.dados?.length) {
    const filtrado = filtrarSnapshotRegistros(json, filtro);
    if (filtrado.dados.length) {
      return { ...filtrado, origem_carregamento: "json" };
    }
  }

  const planilha = await carregarSnapshotTelemetriaPlanilha(filtro);
  if (planilha) return planilha;

  if (json?.dados?.length) {
    return { ...filtrarSnapshotRegistros(json, { fonte, de: "", ate: "" }), origem_carregamento: "json" };
  }
  return null;
}
