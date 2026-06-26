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
    if (!res.ok) return null;
    const payload = await res.json();
    const incidentes = Array.isArray(payload?.incidentes) ? payload.incidentes : [];
    if (!incidentes.length) return null;
    return {
      payload,
      incidentes,
      atualizadoEm: payload.atualizadoEm || null
    };
  } catch (_) {
    return null;
  }
}

async function carregarDoBanco() {
  const snap = await carregarSnapshotAws("/snapshots/incidentes", { timeoutMs: 20000 });
  if (!snap?.payload) return null;
  const incidentes = Array.isArray(snap.payload?.incidentes) ? snap.payload.incidentes : [];
  if (!incidentes.length) return null;
  const atualizadoEm = snap.atualizadoEm || snap.payload?.atualizadoEm || null;
  return {
    payload: {
      ...snap.payload,
      incidentes,
      totalExtraido: incidentes.length,
      atualizadoEm
    },
    incidentes,
    atualizadoEm
  };
}

function timestampFonte(pack) {
  return Date.parse(pack?.atualizadoEm || pack?.payload?.atualizadoEm || 0) || 0;
}

function escolherFonte(awsPack, jsonPack) {
  const aws = awsPack?.incidentes?.length ? awsPack : null;
  const json = jsonPack?.incidentes?.length ? jsonPack : null;
  if (aws && !json) return { pack: aws, origem: "AWS" };
  if (json && !aws) return { pack: json, origem: "JSON" };
  if (!aws && !json) return null;
  return timestampFonte(aws) >= timestampFonte(json)
    ? { pack: aws, origem: "AWS" }
    : { pack: json, origem: "JSON" };
}

/** Leitura: Aurora DSQL via API AWS; JSON estático no GitHub Pages como fallback. */
export async function carregarDadosIncidentes({ onProgress } = {}) {
  onProgress?.("Consultando banco e arquivo...");
  const [awsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarDoBanco(), 20000),
    withTimeout(carregarJsonSnapshot(), 15000)
  ]);

  const awsPack = awsRes.status === "fulfilled" ? awsRes.value : null;
  const jsonPack = jsonRes.status === "fulfilled" ? jsonRes.value : null;
  const tentativas = [
    `AWS: ${awsPack?.incidentes?.length || 0}`,
    `JSON: ${jsonPack?.incidentes?.length || 0}`
  ];

  const escolhida = escolherFonte(awsPack, jsonPack);
  if (!escolhida?.pack?.incidentes?.length) {
    throw new Error("Nenhum incidente encontrado (AWS/JSON).");
  }

  return {
    payload: escolhida.pack.payload,
    origem: escolhida.origem,
    tentativas
  };
}
