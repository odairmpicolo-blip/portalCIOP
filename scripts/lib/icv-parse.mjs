/**
 * Normalização compartilhada dos dados ICV (API pontualidade, CSV ou JSON).
 */

export function pick(row, keys) {
  for (const key of keys) {
    if (row?.[key] != null && String(row[key]).trim() !== "") return row[key];
  }
  return null;
}

export function parseDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseViagensCount(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 500 ? Math.round(value * 1000) : Math.round(value);
  }
  let text = String(value).trim().replace(/\s/g, "");
  if (!text) return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",") && !text.includes(".")) {
    text = text.replace(",", ".");
  } else if (/^\d+\.\d{1,3}$/.test(text)) {
    return Math.round(Number(text) * 1000);
  } else {
    text = text.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(text);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function parseSupressaoCount(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = Number(String(value).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function parseNumber(value) {
  return parseViagensCount(value);
}

export function parsePercent(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1 ? value / 100 : value;
  }
  const text = String(value).trim().replace("%", "").replace(",", ".");
  const n = Number(text);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

export function normalizeIcvRows(rows) {
  return rows.map((row) => {
    const date = parseDate(pick(row, ["date", "data", "Data", "DATA", "Dia", "dia"]));
    if (!date) return null;
    const viag_prog = parseViagensCount(pick(row, ["viag_prog", "Viag. Prog", "Viag Prog", "Viagens Programadas", "Viagens programadas"]));
    const viagens = parseViagensCount(pick(row, ["viagens", "Viagens", "Viagens Realizadas", "Realizadas"]));
    const supressao = parseSupressaoCount(pick(row, ["supressao", "Supressão", "Supressao"]));
    const icvRaw = pick(row, ["icv", "ICV", "Índice de Cumprimento de Viagem", "Indice de Cumprimento de Viagem"]);
    const icv = icvRaw != null && icvRaw !== ""
      ? parsePercent(icvRaw)
      : (viag_prog > 0 ? viagens / viag_prog : 0);
    if (!viag_prog && !viagens && !supressao && !icv) return null;
    return { date, viag_prog, viagens, supressao, icv };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}

export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
}

export function parseCsv(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}

export const ICV_API_URL = "https://script.google.com/macros/s/AKfycbwp-s3tzcxQl0gsm20zSfBb7Rw0bQwKnIX0hB9j_nLDIALZKvu3xeGL9G1jo-SSsXhQ9A/exec";
export const ICV_CSV_URL = "https://docs.google.com/spreadsheets/d/1g-CaJQF2iDK04HiAcD0OM0ilS_eZ4rGppWq6saHO0Do/export?format=csv&gid=0";

export async function fetchIcvRowsFromApi(url = ICV_API_URL, timeoutMs = 120000) {
  const sep = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${sep}_=${Date.now()}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status} na API ICV`);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : (payload.dados || payload.data || payload.rows || []);
  return normalizeIcvRows(rows);
}

export async function fetchIcvRowsFromCsv(url = ICV_CSV_URL, timeoutMs = 120000) {
  const response = await fetch(`${url}&_=${Date.now()}`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status} na planilha ICV`);
  const text = await response.text();
  if (/accounts\.google\.com|ServiceLogin|<html/i.test(text)) {
    throw new Error("Planilha ICV precisa estar publicada ou compartilhada para leitura.");
  }
  return normalizeIcvRows(parseCsv(text));
}
