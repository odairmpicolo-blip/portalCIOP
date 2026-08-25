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
  const dia = de && ate && de === ate ? de : "";
  const path = dia
    ? `/snapshots/incidentes/dia/${dia}`
    : `/snapshots/incidentes${de || ate ? `?${new URLSearchParams({ ...(de ? { de } : {}), ...(ate ? { ate } : {}) })}` : ""}`;
  const snap = await carregarSnapshotAws(path, { timeoutMs: 28000 });
  if (!snap?.payload) return { payload: null, incidentes: [], atualizadoEm: null };
  const incidentes = Array.isArray(snap.payload?.incidentes) ? snap.payload.incidentes : [];
  const atualizadoEm = snap.atualizadoEm || snap.payload?.atualizadoEm || null;
  return { payload: snap.payload, incidentes, atualizadoEm };
}

/** Fluxo de leitura: AWS (base desde DATA_MIN, hora a hora). JSON só se a AWS falhar.
 *  `preferirAws` + mesmo dia: recorte de hoje (monitoramento). */
export async function carregarDadosIncidentes({ onProgress, preferirAws = false, de, ate } = {}) {
  onProgress?.("Consultando AWS e JSON...");
  const soHoje = Boolean(preferirAws && de && ate && de === ate);
  const jobs = [
    withTimeout(carregarAws({ de, ate }), soHoje ? 28000 : 28000),
    withTimeout(carregarJsonHoje(), 8000)
  ];
  if (!soHoje) jobs.push(withTimeout(carregarJsonSnapshot(), 20000));
  const [awsRes, jsonHojeRes, jsonRes] = await Promise.allSettled(jobs);

  const awsPack = awsRes.status === "fulfilled" ? awsRes.value : { payload: null, incidentes: [] };
  const aws = awsPack.incidentes || [];
  const hojePack = jsonHojeRes.status === "fulfilled" ? jsonHojeRes.value : { payload: null, incidentes: [] };
  const hoje = filtrarPorPeriodo(hojePack.incidentes || [], de, ate);
  const jsonPack = jsonRes?.status === "fulfilled" ? jsonRes.value : { payload: null, incidentes: [] };
  const json = filtrarPorPeriodo(jsonPack.incidentes || [], de, ate);

  const tentativas = [`AWS: ${aws.length}`, `hoje: ${hoje.length}`, `JSON: ${json.length}`];
  let incidentes;
  let origem;
  let base;

  if (soHoje) {
    incidentes = aws.length ? aws : (hoje.length ? hoje : json);
    origem = aws.length ? "AWS" : (hoje.length ? "JSON hoje" : "JSON");
    base = aws.length ? awsPack.payload : (hoje.length ? hojePack.payload : jsonPack.payload);
  } else if (aws.length) {
    incidentes = aws;
    origem = "AWS";
    base = awsPack.payload;
  } else {
    incidentes = mesclarIncidentes([json, hoje]);
    origem = [json.length && "JSON", hoje.length && "JSON hoje"].filter(Boolean).join(" · ");
    base = (json.length ? jsonPack.payload : null) || hojePack.payload;
  }

  const payload = montarPayload([base, awsPack.payload, jsonPack.payload, hojePack.payload], incidentes);
  if (base?.atualizadoEm) payload.atualizadoEm = base.atualizadoEm;
  payload.origem = origem || "";
  payload.tentativas = tentativas;

  return {
    payload,
    origem: origem || "",
    tentativas
  };
}
