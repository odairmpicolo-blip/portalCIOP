import { carregarSnapshotAws } from "./portal-aws-config.js";

export const INCIDENTES_JSON_URL = "../assets/data/incidentes-tcgl.json";
export const INCIDENTES_HOJE_JSON_URL = "../assets/data/incidentes-tcgl-hoje.json";

export function hojeIsoLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Mesma regra do dashboard: `data` em DD/MM/AAAA (hora depois do espaço é ignorada). */
export function dataIsoIncidente(row) {
  const bruto = String(row?.data || row?.dataHora || row?.createdAt || "").trim();
  const datePart = bruto.split(/\s+/)[0] || "";
  const br = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(datePart)) return datePart.slice(0, 10);
  const iso = String(row?.data_iso || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && Number(iso.slice(5, 7)) >= 1 && Number(iso.slice(5, 7)) <= 12) {
    return iso;
  }
  return "";
}

export function normalizarDataIsoIncidente(row) {
  return dataIsoIncidente(row);
}

export function incidentesTcglDoDia(payload, diaIso) {
  const dia = diaIso || hojeIsoLocal();
  const empresaPadrao = String(payload?.empresa || "TCGL").toUpperCase();
  return (Array.isArray(payload?.incidentes) ? payload.incidentes : [])
    .filter((r) => {
      const emp = String(r?.empresa || empresaPadrao || "TCGL").toUpperCase();
      return emp === "TCGL" && dataIsoIncidente(r) === dia;
    })
    .sort((a, b) => Number(b.id || b.incidentId || 0) - Number(a.id || a.incidentId || 0));
}

export function idIncidente(row) {
  return String(row?.incidentId || row?.id || "").trim();
}

function chaveIncidente(row) {
  return idIncidente(row) || [
    normalizarDataIsoIncidente(row),
    row?.hora || "",
    row?.veiculo || "",
    row?.linha || ""
  ].join("|");
}

function mesclarIncidentes(listas) {
  const mapa = new Map();
  listas.forEach((lista) => {
    (lista || []).forEach((row) => {
      if (!row) return;
      mapa.set(chaveIncidente(row), row);
    });
  });
  return [...mapa.values()];
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), ms);
    })
  ]);
}

async function carregarJsonHoje() {
  try {
    const res = await fetch(`${INCIDENTES_HOJE_JSON_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { payload: null, incidentes: [] };
    const payload = await res.json();
    const incidentes = Array.isArray(payload?.incidentes) ? payload.incidentes : [];
    return { payload, incidentes };
  } catch (_) {
    return { payload: null, incidentes: [] };
  }
}

async function carregarJsonSnapshot() {
  try {
    const res = await fetch(`${INCIDENTES_JSON_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { payload: null, incidentes: [] };
    const payload = await res.json();
    const incidentes = Array.isArray(payload?.incidentes) ? payload.incidentes : [];
    return { payload, incidentes };
  } catch (_) {
    return { payload: null, incidentes: [] };
  }
}

function filtrarPorPeriodo(incidentes, de, ate) {
  if (!de && !ate) return incidentes;
  return (incidentes || []).filter((row) => {
    const iso = dataIsoIncidente(row);
    if (!iso) return false;
    if (de && iso < de) return false;
    if (ate && iso > ate) return false;
    return true;
  });
}

function montarPayload(fontes, incidentes) {
  const candidatos = fontes.filter(Boolean);
  const base = candidatos.sort((a, b) => {
    const ta = Date.parse(a?.atualizadoEm || 0) || 0;
    const tb = Date.parse(b?.atualizadoEm || 0) || 0;
    return tb - ta;
  })[0] || {};
  const payload = Object.assign({}, base);
  payload.incidentes = incidentes;
  payload.totalExtraido = incidentes.length;
  if (!payload.atualizadoEm) payload.atualizadoEm = new Date().toISOString();
  payload.fonte = payload.fonte || "Gerenciamento de Incidentes";
  payload.empresa = payload.empresa || "TCGL";
  return payload;
}

async function carregarAws({ de, ate } = {}) {
  const path = `/snapshots/incidentes${de || ate ? `?${new URLSearchParams({ ...(de ? { de } : {}), ...(ate ? { ate } : {}) })}` : ""}`;
  const snap = await carregarSnapshotAws(path, { timeoutMs: 20000 });
  if (snap?.url) {
    const res = await fetch(snap.url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} no JSON de incidentes no S3`);
    const payload = await res.json();
    const lista = Array.isArray(payload?.incidentes) ? payload.incidentes : [];
    const incidentes = filtrarPorPeriodo(lista, de, ate);
    return {
      payload: { ...payload, incidentes, totalExtraido: incidentes.length },
      incidentes,
      atualizadoEm: snap.atualizadoEm || payload?.atualizadoEm || null
    };
  }
  if (!snap?.payload) return { payload: null, incidentes: [], atualizadoEm: null };
  const incidentes = Array.isArray(snap.payload?.incidentes) ? snap.payload.incidentes : [];
  const atualizadoEm = snap.atualizadoEm || snap.payload?.atualizadoEm || null;
  return { payload: snap.payload, incidentes, atualizadoEm };
}

/** Mesma leitura da página Incidentes: AWS (S3 horário). JSON do GitHub só se a AWS falhar. */
export async function carregarDadosIncidentes({ onProgress, de, ate } = {}) {
  onProgress?.("Consultando AWS...");
  try {
    const awsPack = await carregarAws({ de, ate });
    const aws = awsPack.incidentes || [];
    if (aws.length) {
      const payload = montarPayload([awsPack.payload], aws);
      if (awsPack.atualizadoEm) payload.atualizadoEm = awsPack.atualizadoEm;
      payload.origem = "AWS";
      payload.tentativas = [`AWS: ${aws.length}`];
      return { payload, origem: "AWS", tentativas: payload.tentativas };
    }
  } catch (err) {
    console.warn("[incidentes] AWS:", err?.message || err);
  }

  onProgress?.("AWS indisponível, consultando JSON...");
  const jsonPack = await carregarJsonSnapshot();
  const json = filtrarPorPeriodo(jsonPack.incidentes || [], de, ate);
  const payload = montarPayload([jsonPack.payload], json);
  payload.origem = json.length ? "JSON" : "";
  payload.tentativas = [`AWS: 0`, `JSON: ${json.length}`];
  return {
    payload,
    origem: payload.origem,
    tentativas: payload.tentativas
  };
}
