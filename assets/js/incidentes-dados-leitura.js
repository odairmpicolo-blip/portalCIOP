import { carregarSnapshotAws } from "./portal-aws-config.js";

export const INCIDENTES_JSON_URL = "../assets/data/incidentes-tcgl.json";

export function normalizarDataIsoIncidente(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(br) ? br.slice(0, 10) : "";
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
  const snap = await carregarSnapshotAws("/snapshots/incidentes", { timeoutMs: 12000 });
  if (!snap?.payload) return { payload: null, incidentes: [], atualizadoEm: null };
  const incidentes = Array.isArray(snap.payload?.incidentes) ? snap.payload.incidentes : [];
  const atualizadoEm = snap.atualizadoEm || snap.payload?.atualizadoEm || null;
  return { payload: snap.payload, incidentes, atualizadoEm };
}

/** Fluxo de leitura: AWS → JSON (planilha). */
export async function carregarDadosIncidentes({ onProgress } = {}) {
  onProgress?.("Consultando AWS e JSON...");
  const [awsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarAws(), 15000),
    withTimeout(carregarJsonSnapshot(), 20000)
  ]);

  const awsPack = awsRes.status === "fulfilled" ? awsRes.value : { payload: null, incidentes: [] };
  const aws = awsPack.incidentes || [];
  const jsonPack = jsonRes.status === "fulfilled" ? jsonRes.value : { payload: null, incidentes: [] };
  const json = jsonPack.incidentes || [];

  const tentativas = [`AWS: ${aws.length}`, `JSON: ${json.length}`];
  const origens = [];
  if (aws.length) origens.push("AWS");
  if (json.length) origens.push("JSON");

  const incidentes = mesclarIncidentes([json, aws]);
  const payload = montarPayload(
    [jsonPack.payload, awsPack.payload].filter(Boolean),
    incidentes
  );

  return {
    payload,
    origem: origens.join(" · ") || "",
    tentativas
  };
}
