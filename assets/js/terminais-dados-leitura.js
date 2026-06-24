import { carregarSnapshotAws } from "./portal-aws-config.js";

export const TERMINAIS_JSON_URL = "../assets/data/terminais-agora.json";

export function reidratarSnapshotTerminais(payload) {
  if (!payload) return null;
  return {
    DADOS: payload.DADOS || [],
    MAP_TERMINAL_TELEFONE: payload.MAP_TERMINAL_TELEFONE || {},
    REGISTROS: (payload.REGISTROS || []).map((item) => ({
      ...item,
      data: item.data ? new Date(item.data) : null,
      start: item.start ? new Date(item.start) : null,
      end: item.end ? new Date(item.end) : null
    })),
    atualizadoEm: payload.atualizadoEm || null,
    fonte: payload.fonte || ""
  };
}

export function mapTerminalTelefoneFromPlain(obj) {
  if (obj instanceof Map) return obj;
  return new Map(Object.entries(obj || {}));
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
    const res = await fetch(`${TERMINAIS_JSON_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return reidratarSnapshotTerminais(await res.json());
  } catch (_) {
    return null;
  }
}

async function carregarAws() {
  const snap = await carregarSnapshotAws("/terminais/atual", { timeoutMs: 12000 });
  if (!snap?.payload) return null;
  return reidratarSnapshotTerminais(snap.payload);
}

function escolherSnapshot(candidatos) {
  const validos = candidatos.filter((item) => item?.REGISTROS?.length);
  if (!validos.length) return null;
  validos.sort((a, b) => {
    const ta = new Date(a.atualizadoEm || 0).getTime();
    const tb = new Date(b.atualizadoEm || 0).getTime();
    return tb - ta;
  });
  return validos[0];
}

/** Fluxo de leitura: AWS → JSON (planilha). */
export async function carregarDadosTerminais({ onProgress } = {}) {
  onProgress?.("Consultando AWS e JSON...");
  const [awsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarAws(), 20000),
    withTimeout(carregarJsonSnapshot(), 15000)
  ]);

  const aws = awsRes.status === "fulfilled" ? awsRes.value : null;
  const json = jsonRes.status === "fulfilled" ? jsonRes.value : null;
  const snapshot = escolherSnapshot([
    aws ? { ...aws, _origem: "AWS" } : null,
    json ? { ...json, _origem: "JSON" } : null
  ]);

  const origens = [];
  if (aws?.REGISTROS?.length) origens.push("AWS");
  if (json?.REGISTROS?.length) origens.push("JSON");

  return {
    payload: snapshot,
    origem: snapshot?._origem || origens.join(" · ") || "",
    tentativas: [
      `AWS: ${aws?.REGISTROS?.length || 0}`,
      `JSON: ${json?.REGISTROS?.length || 0}`
    ]
  };
}
