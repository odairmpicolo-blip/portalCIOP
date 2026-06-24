export const LIBERACAO_API_URL = "https://script.google.com/macros/s/AKfycby9hpIGulGYxlm_Oseasi_D2GIaLSvusFNqcgrSj7l7HwxcUXLTPqd8kX1JxwkCx9lqOA/exec";
export const LIBERACAO_DATA_BASE = "../assets/data/liberacao";
export const LIBERACAO_MANIFEST_URL = `${LIBERACAO_DATA_BASE}/manifest.json`;
export const LIBERACAO_ACOMPANHAMENTO_URL = `${LIBERACAO_DATA_BASE}/acompanhamento-semana.json`;
export const CACHE_STORAGE_KEY = "portal_liberacao_lancamento_v2";

export function normalizarDataIsoRow(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(br) ? br : "";
}

function listarDatasIsoJanela(dataDe, dataAte) {
  if (!dataDe || !dataAte || dataAte < dataDe) return [];
  const out = [];
  const [y0, m0, d0] = dataDe.split("-").map(Number);
  const [y1, m1, d1] = dataAte.split("-").map(Number);
  const cursor = new Date(Date.UTC(y0, m0 - 1, d0));
  const fim = new Date(Date.UTC(y1, m1 - 1, d1));
  while (cursor <= fim) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function chaveLinha(row) {
  const id = String(row?._row || "").trim();
  if (id) return `_row:${id}`;
  return [
    normalizarDataIsoRow(row),
    row?.maquina || "",
    row?.linha || "",
    row?.work_id || "",
    row?.carro || ""
  ].join("|");
}

function mesclarLinhas(listas) {
  const mapa = new Map();
  listas.forEach((lista) => {
    (lista || []).forEach((row) => {
      if (!row) return;
      mapa.set(chaveLinha(row), row);
    });
  });
  return [...mapa.values()];
}

function filtrarPeriodo(dados, dataDe, dataAte) {
  return (dados || []).filter((row) => {
    const iso = normalizarDataIsoRow(row);
    return iso && iso >= dataDe && iso <= dataAte;
  });
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), ms);
    })
  ]);
}

async function carregarManifestLiberacao() {
  try {
    const res = await fetch(LIBERACAO_MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

function urlSnapshotDia(data, manifest) {
  const arquivo = manifest?.dias?.[data];
  if (arquivo) return `${LIBERACAO_DATA_BASE}/${arquivo}`;
  return `${LIBERACAO_DATA_BASE}/acompanhamento-dia-${data}.json`;
}

async function carregarSnapshotDia(data, manifest) {
  if (!data) return [];
  const precargaHoje = window.__liberacaoPrecargaHoje;
  const precargaIso = window.__liberacaoPrecargaHojeIso;
  if (precargaHoje && precargaIso === data) {
    try {
      const payload = await precargaHoje;
      if (Array.isArray(payload?.dados) && payload.dados.length) return payload.dados;
    } catch (_) { /* continua */ }
  }
  try {
    const res = await fetch(`${urlSnapshotDia(data, manifest)}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    return Array.isArray(payload?.dados) ? payload.dados : [];
  } catch (_) {
    return [];
  }
}

async function carregarSnapshotSemana(manifest) {
  const precarga = window.__liberacaoPrecargaSemana;
  if (precarga) {
    try {
      const payload = await precarga;
      if (Array.isArray(payload?.dados) && payload.dados.length) return payload.dados;
    } catch (_) { /* continua */ }
  }
  try {
    const arquivo = manifest?.acompanhamento?.arquivo;
    const url = arquivo ? `${LIBERACAO_DATA_BASE}/${arquivo}` : LIBERACAO_ACOMPANHAMENTO_URL;
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    return Array.isArray(payload?.dados) ? payload.dados : [];
  } catch (_) {
    return [];
  }
}

function lerCacheLocal(dataDe, dataAte) {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.dados)) return [];
    return filtrarPeriodo(parsed.dados, dataDe, dataAte);
  } catch (_) {
    return [];
  }
}

async function carregarDadosJson(dataDe, dataAte, manifest) {
  const dias = listarDatasIsoJanela(dataDe, dataAte);
  const partes = await Promise.all(dias.map((dia) => carregarSnapshotDia(dia, manifest)));
  let dados = mesclarLinhas(partes);
  if (!dados.length) {
    dados = filtrarPeriodo(await carregarSnapshotSemana(manifest), dataDe, dataAte);
  }
  return dados;
}

async function apiGet(params) {
  const url = `${LIBERACAO_API_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "acompanhamento",
    ...params,
    _: String(Date.now())
  })}`;
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch (_) {
    throw new Error("Resposta inválida da planilha.");
  }
  if (!data.ok) throw new Error(data.erro || "Erro ao buscar dados.");
  return data.dados || [];
}

async function carregarDadosApi(dataDe, dataAte) {
  if (dataDe === dataAte) {
    return await apiGet({ data: dataDe, limit: "0", vivo: "1" });
  }
  return await apiGet({ data_de: dataDe, data_ate: dataAte, ultima_semana: "0", vivo: "1" });
}

/**
 * Carrega dados da liberação para um período (cache local, JSON e planilha).
 */
export async function carregarDadosLiberacaoPeriodo(dataDe, dataAte, { onProgress } = {}) {
  const manifest = await carregarManifestLiberacao();
  const tentativas = [];

  onProgress?.("Consultando cache e JSON...");
  const [cacheRes, jsonRes] = await Promise.allSettled([
    Promise.resolve(lerCacheLocal(dataDe, dataAte)),
    withTimeout(carregarDadosJson(dataDe, dataAte, manifest), 15000)
  ]);

  const cache = cacheRes.status === "fulfilled" ? cacheRes.value : [];
  const json = jsonRes.status === "fulfilled" ? jsonRes.value : [];

  if (cacheRes.status === "rejected") tentativas.push("cache: erro");
  else tentativas.push(`cache: ${cache.length}`);
  if (jsonRes.status === "rejected") tentativas.push("JSON: erro/timeout");
  else tentativas.push(`JSON: ${json.length}`);

  let dados = mesclarLinhas([cache, json]);
  const origens = [];
  if (cache.length) origens.push("cache local");
  if (json.length) origens.push("JSON");

  if (!dados.length) {
    onProgress?.("Buscando na planilha (pode levar até 2 min)...");
    try {
      const planilha = await withTimeout(carregarDadosApi(dataDe, dataAte), 120000);
      tentativas.push(`planilha: ${planilha.length}`);
      if (planilha.length) {
        dados = filtrarPeriodo(planilha, dataDe, dataAte);
        if (dados.length) origens.push("planilha");
      }
    } catch (err) {
      tentativas.push(`planilha: ${err.message === "timeout" ? "timeout" : "erro"}`);
    }
  }

  return {
    dados,
    origem: origens.join(" · ") || "",
    tentativas
  };
}
