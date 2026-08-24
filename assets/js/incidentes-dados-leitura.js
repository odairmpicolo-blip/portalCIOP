import { carregarSnapshotAws } from "./portal-aws-config.js";

export const INCIDENTES_JSON_URL = "../assets/data/incidentes-tcgl.json";

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

async function carregarAws() {
  const snap = await carregarSnapshotAws("/snapshots/incidentes", { timeoutMs: 25000 });
  if (!snap?.payload) return { payload: null, incidentes: [], atualizadoEm: null };
  const incidentes = Array.isArray(snap.payload?.incidentes) ? snap.payload.incidentes : [];
  const atualizadoEm = snap.atualizadoEm || snap.payload?.atualizadoEm || null;
  return { payload: snap.payload, incidentes, atualizadoEm };
}

/** Fluxo de leitura: AWS → JSON. `preferirAws` usa só o snapshot se ele tiver linhas (visão ao vivo / hoje). */
export async function carregarDadosIncidentes({ onProgress, preferirAws = false } = {}) {
  onProgress?.("Consultando AWS e JSON...");
  const [awsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarAws(), 30000),
    withTimeout(carregarJsonSnapshot(), 20000)
  ]);

  const awsPack = awsRes.status === "fulfilled" ? awsRes.value : { payload: null, incidentes: [] };
  const aws = awsPack.incidentes || [];
  const jsonPack = jsonRes.status === "fulfilled" ? jsonRes.value : { payload: null, incidentes: [] };
  const json = jsonPack.incidentes || [];

  const tentativas = [`AWS: ${aws.length}`, `JSON: ${json.length}`];
  const origens = [];
  if (aws.length) origens.push("AWS");
  if (json.length && !(preferirAws && aws.length)) origens.push("JSON");

  const incidentes = preferirAws && aws.length ? aws : mesclarIncidentes([json, aws]);
  const bases = preferirAws && awsPack.payload
    ? [awsPack.payload]
    : [jsonPack.payload, awsPack.payload].filter(Boolean);
  const payload = montarPayload(bases, incidentes);
  payload.origem = origens.join(" · ") || "";

  return {
    payload,
    origem: origens.join(" · ") || "",
    tentativas
  };
}
