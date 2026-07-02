/**
 * Parser compartilhado — planilhas Clever / TCGL (CSV/XLSX).
 */
import {
  agregarLinhasTelemetria,
  normalizarColunaTelemetria,
  normChaveMerge
} from "../../backend/src/lib/telemetria-merge.js";

export function normChave(s) {
  return normChaveMerge(s);
}

export function normVeiculo(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits) return String(parseInt(digits, 10));
  return s.toUpperCase();
}

export function parseDataCsv(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return "";
}

function valorPreenchido(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return !["-", "—", "n/a", "na", "null", "undefined", "#n/a"].includes(low);
}

export function encontrarLinhaCabecalho(linhas) {
  const chavesVeiculo = ["veiculo", "vehicle id", "vehicle"];
  for (let i = 0; i < Math.min(linhas.length, 12); i++) {
    const row = linhas[i] || [];
    const textos = row.map((c) => normChave(String(c ?? "").trim())).filter(Boolean);
    if (textos.some((t) => chavesVeiculo.includes(t) || t.includes("veiculo"))) return i;
  }
  return 0;
}

export function converterPlanilha(linhas) {
  if (!linhas.length) return { headers: [], rows: [] };
  const idx = encontrarLinhaCabecalho(linhas);
  const pares = [];
  (linhas[idx] || []).forEach((h, i) => {
    const col = normalizarColunaTelemetria(String(h).trim());
    if (col) pares.push({ i, col });
  });
  const rows = linhas.slice(idx + 1).map((cols) => {
    const obj = {};
    pares.forEach(({ i, col }) => {
      obj[col] = cols[i] != null ? String(cols[i]).trim() : "";
    });
    return obj;
  }).filter((row) => Object.values(row).some(valorPreenchido));
  return { headers: [...new Set(pares.map((p) => p.col))], rows };
}

const CHAVES_VEICULO = ["veiculo", "vehicle id", "vehicle"];
const CHAVES_DATA = ["data", "date", "dia"];

function detectarColuna(headers, chaves) {
  for (const h of headers) {
    const n = normChave(h);
    if (chaves.includes(n)) return h;
  }
  for (const h of headers) {
    const n = normChave(h);
    if (chaves.some((k) => n.includes(k))) return h;
  }
  return null;
}

export function linhasParaRegistros(rows, headers, fonte, origemArquivo) {
  const colVeiculo = detectarColuna(headers, CHAVES_VEICULO);
  const colData = detectarColuna(headers, CHAVES_DATA);
  if (!colVeiculo || !colData) return [];

  const grupos = new Map();
  rows.forEach((row) => {
    const data_iso = parseDataCsv(row[colData]);
    const veiculo = normVeiculo(row[colVeiculo]);
    if (!data_iso || !veiculo) return;
    const key = `${data_iso}|${veiculo}`;
    const payload = { ...row, data_iso, veiculo_norm: veiculo };
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(payload);
  });

  const registros = [];
  for (const [key, grupo] of grupos) {
    const [data_iso, veiculo] = key.split("|");
    const agregado = agregarLinhasTelemetria(grupo);
    registros.push({
      data_iso,
      veiculo,
      fonte,
      payload: { ...agregado, Veiculo: veiculo, Data: data_iso, data_iso, veiculo_norm: veiculo },
      origem_arquivo: origemArquivo
    });
  }
  return registros;
}
