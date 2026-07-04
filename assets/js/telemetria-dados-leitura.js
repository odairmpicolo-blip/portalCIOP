/**
 * Telemetria — planilha Google (Apps Script) com fallback para JSON estático (GitHub Pages).
 */
export const TELEMETRIA_DATA_BASE = "../assets/data/telemetria";
export const TELEMETRIA_DADOS_URL = `${TELEMETRIA_DATA_BASE}/dados.json`;
export const TELEMETRIA_MANIFEST_URL = `${TELEMETRIA_DATA_BASE}/manifest.json`;

const SNAPSHOT_CACHE_KEY = "portal_telemetria_snapshot_v1";
const SNAPSHOT_CACHE_TTL_MS = 15 * 60 * 1000;

let telemetriaScriptUrlCache = "";

const FONTES_PLANILHA = ["clever", "tcgl", "fleetbus"];
const JSON_FETCH_TIMEOUT_MS = 90000;

function urlsTelemetriaAsset(relativePath) {
  const urls = [relativePath];
  if (typeof window !== "undefined") {
    const base = window.location.pathname.replace(/\/pages\/.*$/, "").replace(/\/$/, "");
    const abs = `${base}/${relativePath.replace(/^\.\.\//, "")}`;
    if (!urls.includes(abs)) urls.push(abs);
  }
  return urls;
}

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

export function mesclarRegistrosTelemetria(atual, novos) {
  const mapa = new Map();
  const key = (r) => `${r.data_iso}|${inferirFonteRegistro(r)}|${String(r.veiculo || "").trim()}`;
  (atual || []).forEach((r) => mapa.set(key(r), { ...r, fonte: inferirFonteRegistro(r) }));
  (novos || []).forEach((r) => mapa.set(key(r), { ...r, fonte: inferirFonteRegistro(r) }));
  return [...mapa.values()];
}

function valorPreenchidoTelemetria(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return !["-", "—", "n/a", "na", "null", "undefined", "#n/a"].includes(low);
}

/** Clever tem Início/Registros CAN; TCGL só km/consumo; FleetBus marcado explicitamente. */
export function inferirFonteRegistro(reg) {
  const explicit = String(reg?.fonte || "").toLowerCase();
  if (explicit === "fleetbus") return "fleetbus";
  let payload = reg?.payload || reg;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
  }
  const temInicio = valorPreenchidoTelemetria(payload?.Inicio) || valorPreenchidoTelemetria(payload?.["Start time local"]);
  const temCan = valorPreenchidoTelemetria(payload?.["Registros CAN"]) || valorPreenchidoTelemetria(payload?.["Number of events"]);
  if (temInicio || temCan) return "clever";
  if (explicit === "clever" || explicit === "tcgl") return explicit;
  return "tcgl";
}

export function normalizarFontesRegistros(dados) {
  return (dados || []).map((d) => ({ ...d, fonte: inferirFonteRegistro(d) }));
}

export function filtrarSnapshotRegistros(snap, { fonte = "todos", de = "", ate = "" } = {}) {
  if (!snap?.dados?.length) return snap;
  let dados = normalizarFontesRegistros(snap.dados);
  if (fonte && fonte !== "todos") {
    dados = dados.filter((d) => d.fonte === fonte);
  }
  if (de) dados = dados.filter((d) => d.data_iso && d.data_iso >= de);
  if (ate) dados = dados.filter((d) => d.data_iso && d.data_iso <= ate);
  const clever = dados.filter((d) => d.fonte === "clever").length;
  const tcgl = dados.filter((d) => d.fonte === "tcgl").length;
  const fleetbus = dados.filter((d) => d.fonte === "fleetbus").length;
  const datas = dados.map((d) => d.data_iso).filter(Boolean).sort();
  return {
    ...snap,
    dados,
    total: dados.length,
    total_clever: clever,
    total_tcgl: tcgl,
    total_fleetbus: fleetbus,
    data_de: datas[0] || null,
    data_ate: datas[datas.length - 1] || null
  };
}

/** Mantém fontes que falharam na planilha; substitui só as que vieram no snapshot novo. */
export function mesclarSnapshotPorFonte(anterior, novo, { fonte = "todos" } = {}) {
  if (!novo?.dados?.length) return anterior || null;

  const novosNorm = normalizarFontesRegistros(novo.dados);
  const novosPorFonte = new Map();
  novosNorm.forEach((d) => {
    if (!novosPorFonte.has(d.fonte)) novosPorFonte.set(d.fonte, []);
    novosPorFonte.get(d.fonte).push(d);
  });

  const fontesSubstituir = fonte === "todos"
    ? FONTES_PLANILHA.filter((f) => (novosPorFonte.get(f) || []).length)
    : (novosPorFonte.has(fonte) ? [fonte] : []);

  const manter = normalizarFontesRegistros(anterior?.dados || []).filter((d) => {
    if (!FONTES_PLANILHA.includes(d.fonte)) return true;
    return !fontesSubstituir.includes(d.fonte);
  });

  const novos = fontesSubstituir.flatMap((f) => novosPorFonte.get(f) || []);
  const dados = [...manter, ...novos];
  if (!dados.length) return null;

  const clever = dados.filter((d) => d.fonte === "clever").length;
  const tcgl = dados.filter((d) => d.fonte === "tcgl").length;
  const fleetbus = dados.filter((d) => d.fonte === "fleetbus").length;
  const datas = dados.map((d) => d.data_iso).filter(Boolean).sort();

  return {
    ...(anterior || {}),
    ...novo,
    dados,
    total: dados.length,
    total_clever: clever,
    total_tcgl: tcgl,
    total_fleetbus: fleetbus,
    data_de: datas[0] || novo.data_de || null,
    data_ate: datas[datas.length - 1] || novo.data_ate || null,
    origem_carregamento: novo.origem_carregamento || anterior?.origem_carregamento || "planilha"
  };
}

async function fetchJsonComTimeout(url, timeoutMs = JSON_FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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

function combinarSnapshotsPlanilha(cleverSnap, tcglSnap, de, ate, fleetbusSnap) {
  const dados = normalizarFontesRegistros([
    ...(cleverSnap?.dados || []),
    ...(tcglSnap?.dados || []),
    ...(fleetbusSnap?.dados || [])
  ]);
  if (!dados.length) return null;
  const datas = dados.map((d) => d.data_iso).filter(Boolean).sort();
  return {
    ok: true,
    script_versao: cleverSnap?.script_versao || tcglSnap?.script_versao || fleetbusSnap?.script_versao,
    atualizadoEm: cleverSnap?.atualizadoEm || tcglSnap?.atualizadoEm || fleetbusSnap?.atualizadoEm || new Date().toISOString(),
    origem: "google-sheets",
    total: dados.length,
    total_clever: dados.filter((d) => d.fonte === "clever").length,
    total_tcgl: dados.filter((d) => d.fonte === "tcgl").length,
    total_fleetbus: dados.filter((d) => d.fonte === "fleetbus").length,
    data_de: datas[0] || de || null,
    data_ate: datas[datas.length - 1] || ate || null,
    dados,
    origem_carregamento: "planilha"
  };
}

export async function carregarManifestTelemetria() {
  for (const base of urlsTelemetriaAsset(TELEMETRIA_MANIFEST_URL)) {
    try {
      const data = await fetchJsonComTimeout(`${base}?t=${Date.now()}`, 30000);
      if (data?.atualizadoEm) return data;
    } catch (_) {
      /* próximo candidato */
    }
  }
  return null;
}

export async function carregarSnapshotTelemetriaJson() {
  let ultimoErro = "";
  for (const base of urlsTelemetriaAsset(TELEMETRIA_DADOS_URL)) {
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const data = await fetchJsonComTimeout(`${base}?t=${Date.now()}`);
        if (!Array.isArray(data?.dados) || !data.dados.length) {
          ultimoErro = "JSON vazio ou sem registros";
          break;
        }
        return {
          ...data,
          dados: normalizarFontesRegistros(data.dados),
          origem_carregamento: "json"
        };
      } catch (err) {
        ultimoErro = err?.name === "AbortError" ? "timeout ao baixar JSON" : (err?.message || String(err));
        if (tentativa < 2) await new Promise((r) => setTimeout(r, 800));
      }
    }
  }
  if (ultimoErro) console.warn("Telemetria JSON:", ultimoErro);
  return null;
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

const FLEETBUS_SHEET_ID = "1Z_rFA-1jz7-kq4juGp5uFG4WMpVBloML98hDgWcX9gQ";
const FLEETBUS_GID = "1035972881";

function normalizarDataIsoLeitura(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

function normalizarVeiculoLeitura(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  return digits ? String(parseInt(digits, 10)) : s.toUpperCase();
}

async function carregarFleetbusDiretoDaPlanilha(de, ate) {
  const url = `https://docs.google.com/spreadsheets/d/${FLEETBUS_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${FLEETBUS_GID}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const texto = await res.text();
    if (!texto.trim()) return null;

    const linhas = texto.trim().split(/\r?\n/);
    if (linhas.length < 2) return null;

    const parseRow = (line) => {
      const cols = [];
      let cell = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
          if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
          else if (c === '"') inQuotes = false;
          else cell += c;
        } else {
          if (c === '"') inQuotes = true;
          else if (c === ',') { cols.push(cell.trim()); cell = ""; }
          else cell += c;
        }
      }
      cols.push(cell.trim());
      return cols;
    };

    const headers = parseRow(linhas[0]).map((h) => h.toLowerCase().trim());
    const iVeiculo = headers.findIndex((h) => h === "veiculo" || h === "prefixo" || h.includes("veiculo"));
    const iData = headers.findIndex((h) => h === "data" || h === "date" || h === "dia");
    const iKm = headers.findIndex((h) => h.includes("km percorrido") || h.includes("distancia") || h.includes("distância"));
    if (iVeiculo < 0 || iData < 0) return null;

    const dados = [];
    for (let i = 1; i < linhas.length; i++) {
      if (!linhas[i].trim()) continue;
      const cols = parseRow(linhas[i]);
      const veiculo = normalizarVeiculoLeitura(cols[iVeiculo]);
      const dataIso = normalizarDataIsoLeitura(cols[iData]);
      if (!veiculo || !dataIso) continue;
      if (de && dataIso < de) continue;
      if (ate && dataIso > ate) continue;

      const kmPercorrido = cols[iKm] != null ? String(cols[iKm]).replace(/\./g, "").replace(",", ".").trim() : "";

      const payload = {
        Veiculo: veiculo,
        Data: dataIso,
        "Km Percorrido": kmPercorrido,
        data_iso: dataIso,
        veiculo_norm: veiculo
      };

      dados.push({
        data_iso: dataIso,
        veiculo,
        fonte: "fleetbus",
        payload,
        origem_arquivo: "planilha-fleetbus"
      });
    }

    if (!dados.length) return null;
    const datas = dados.map((d) => d.data_iso).filter(Boolean).sort();
    return {
      ok: true,
      atualizadoEm: new Date().toISOString(),
      origem: "google-sheets-direct",
      total: dados.length,
      total_fleetbus: dados.length,
      data_de: datas[0] || de || null,
      data_ate: datas[datas.length - 1] || ate || null,
      dados,
      origem_carregamento: "planilha"
    };
  } catch (_) {
    return null;
  }
}

async function carregarSnapshotTelemetriaPlanilhaFonte(fonte, de, ate, { skipCache = false } = {}) {
  const opcoes = { fonte, de, ate };
  if (!skipCache) {
    const cached = lerCacheSnapshot(opcoes);
    if (cached) return cached;
  }

  if (fonte === "fleetbus") {
    const direct = await carregarFleetbusDiretoDaPlanilha(de, ate);
    if (direct) {
      gravarCacheSnapshot(direct, opcoes, "planilha");
      return direct;
    }
  }

  const base = await obterUrlTelemetriaScript();
  if (!base) return null;
  const params = new URLSearchParams();
  params.set("fonte", fonte);
  if (de) params.set("de", de);
  if (ate) params.set("ate", ate);
  const sep = base.includes("?") ? "&" : "?";
  const url = `${base}${sep}${params.toString()}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.dados) || !data.dados.length) return null;
    const snap = { ...data, dados: normalizarFontesRegistros(data.dados), origem_carregamento: "planilha" };
    gravarCacheSnapshot(snap, opcoes, "planilha");
    return snap;
  } catch (_) {
    return null;
  }
}

/**
 * fonte=todos busca Clever e TCGL em paralelo (fonte=todos no Apps Script estoura timeout).
 * skipCache=true forca busca fresca (usado pelo modo "ao vivo").
 */
export async function carregarSnapshotTelemetriaPlanilha({ fonte = "todos", de = "", ate = "", skipCache = false } = {}) {
  if (fonte === "todos") {
    const opcoes = { fonte: "todos", de, ate };
    if (!skipCache) {
      const cached = lerCacheSnapshot(opcoes);
      if (cached) return cached;
    }

    const [cleverSnap, tcglSnap, fleetbusSnap] = await Promise.all([
      carregarSnapshotTelemetriaPlanilhaFonte("clever", de, ate, { skipCache }),
      carregarSnapshotTelemetriaPlanilhaFonte("tcgl", de, ate, { skipCache }),
      carregarSnapshotTelemetriaPlanilhaFonte("fleetbus", de, ate, { skipCache })
    ]);
    const comb = combinarSnapshotsPlanilha(cleverSnap, tcglSnap, de, ate, fleetbusSnap);
    if (comb) gravarCacheSnapshot(comb, opcoes, "planilha");
    return comb;
  }

  return carregarSnapshotTelemetriaPlanilhaFonte(fonte, de, ate, { skipCache });
}

/**
 * JSON local primeiro (rápido), depois planilha com período limitado.
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
