import { carregarSnapshotAws } from "./portal-aws-config.js";

export const PONTUALIDADE_DATA_BASE = "../assets/data/pontualidade";
export const PONTUALIDADE_MANIFEST_URL = `${PONTUALIDADE_DATA_BASE}/manifest.json`;

export const CENARIOS_URL = {
  padrao: "https://script.google.com/macros/s/AKfycbwp-s3tzcxQl0gsm20zSfBb7Rw0bQwKnIX0hB9j_nLDIALZKvu3xeGL9G1jo-SSsXhQ9A/exec",
  alternativo: "https://script.google.com/macros/s/AKfycbypfszDiFW2RTgoIvnzSYNSHALfCePOINDaFfcViFIcYqXEj3-O9NXsbs-mdRJ2I2jF/exec"
};

function normalizarDataIso(row) {
  const bruto = row?.date || row?.data || row?.data_iso || "";
  const text = String(bruto).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const p = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return "";
}

function parsePercentValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  let text = String(value).trim().replace("%", "").replace(",", ".");
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return number > 1 ? number / 100 : number;
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  return null;
}

export function normalizarLinhasPontualidade(payload) {
  let rows = Array.isArray(payload) ? payload : (payload?.dados || payload?.data || payload?.rows || payload?.valores || []);
  if (Array.isArray(rows) && Array.isArray(rows[0])) {
    const headers = rows[0].map((h) => String(h).trim());
    rows = rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i]])));
  }
  return rows.map((row) => {
    const date = normalizarDataIso(row);
    if (!date) return null;
    return {
      date,
      no_horario: parsePercentValue(pickValue(row, ["no_horario", "noHorario", "No Horário", "No horario", "NO HORARIO", "Pontualidade", "pontualidade"])),
      adiantado: parsePercentValue(pickValue(row, ["adiantado", "Adiantado", "ADIANTADO"])),
      atrasado: parsePercentValue(pickValue(row, ["atrasado", "Atrasado", "ATRASADO"]))
    };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}

function mesclarPorData(listas) {
  const mapa = new Map();
  listas.forEach((lista) => {
    (lista || []).forEach((row) => {
      if (row?.date) mapa.set(row.date, row);
    });
  });
  return [...mapa.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), ms);
    })
  ]);
}

async function carregarJsonCenario(cenario) {
  try {
    const res = await fetch(`${PONTUALIDADE_DATA_BASE}/${encodeURIComponent(cenario)}.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { meta: null, dados: [] };
    const payload = await res.json();
    const bruto = payload.dados != null ? payload.dados : payload;
    return { meta: payload, dados: normalizarLinhasPontualidade(bruto) };
  } catch (_) {
    return { meta: null, dados: [] };
  }
}

async function carregarPlanilha(cenario) {
  const url = CENARIOS_URL[cenario];
  if (!url) throw new Error("Cenário inválido.");
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}_=${Date.now()}`, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();
  return normalizarLinhasPontualidade(payload);
}

async function carregarAws(cenario) {
  const snap = await carregarSnapshotAws(`/snapshots/pontualidade/${encodeURIComponent(cenario)}`, { timeoutMs: 12000 });
  if (!snap?.payload) return [];
  const bruto = snap.payload.dados != null ? snap.payload.dados : snap.payload;
  return normalizarLinhasPontualidade(bruto);
}

/** Fluxo de leitura por cenário: AWS → JSON → planilha. */
export async function carregarDadosPontualidade(cenario, { onProgress } = {}) {
  const tentativas = [];
  const origens = [];

  onProgress?.("Consultando AWS e JSON...");
  const [awsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarAws(cenario), 15000),
    withTimeout(carregarJsonCenario(cenario), 15000)
  ]);

  const aws = awsRes.status === "fulfilled" ? awsRes.value : [];
  const jsonPack = jsonRes.status === "fulfilled" ? jsonRes.value : { meta: null, dados: [] };
  const json = jsonPack.dados || [];

  tentativas.push(`AWS: ${aws.length}`);
  tentativas.push(`JSON: ${json.length}`);

  let dados = mesclarPorData([json, aws]);
  if (aws.length) origens.push("AWS");
  if (json.length) origens.push("JSON");

  onProgress?.("Complementando com planilha...");
  try {
    const planilha = await withTimeout(carregarPlanilha(cenario), 90000);
    tentativas.push(`planilha: ${planilha.length}`);
    if (planilha.length) {
      dados = mesclarPorData([dados, planilha]);
      origens.push("planilha");
    }
  } catch (err) {
    tentativas.push(`planilha: ${err.message === "timeout" ? "timeout" : "erro"}`);
  }

  return {
    dados,
    meta: jsonPack.meta,
    origem: origens.join(" · ") || "",
    tentativas
  };
}
