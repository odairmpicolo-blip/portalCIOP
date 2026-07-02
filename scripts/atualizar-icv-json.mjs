import fs from "node:fs";
import path from "node:path";

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const outputDir = path.join(portalRoot, "assets", "data", "icv");
const TIMEOUT_MS = Number(process.env.ICV_TIMEOUT_MS || 120000);
const CSV_URL = process.env.ICV_CSV_URL
  || "https://docs.google.com/spreadsheets/d/1g-CaJQF2iDK04HiAcD0OM0ilS_eZ4rGppWq6saHO0Do/export?format=csv&gid=0";

function parseCsvLine(line) {
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

function parseCsv(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
  });
}

function pick(row, keys) {
  for (const key of keys) {
    if (row?.[key] != null && String(row[key]).trim() !== "") return row[key];
  }
  return null;
}

function parseDate(value) {
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

function parseNumber(value) {
  if (value == null || value === "") return 0;
  const n = Number(String(value).replace(/\./g, "").replace(",", ".").replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

function parsePercent(value) {
  const n = parseNumber(value);
  if (!n) return 0;
  return n > 1 ? n / 100 : n;
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const date = parseDate(pick(row, ["data", "Data", "DATA", "Dia", "dia", "date"]));
    if (!date) return null;
    const viag_prog = parseNumber(pick(row, ["Viag. Prog", "Viag Prog", "viag_prog", "Viagens Programadas", "Viagens programadas"]));
    const viagens = parseNumber(pick(row, ["Viagens", "viagens", "Viagens Realizadas", "Realizadas"]));
    const supressao = parseNumber(pick(row, ["Supressão", "Supressao", "supressao", "Supressao (viagens)"]));
    const icvRaw = pick(row, ["ICV", "icv", "Índice de Cumprimento de Viagem", "Indice de Cumprimento de Viagem"]);
    const icv = icvRaw != null && icvRaw !== ""
      ? parsePercent(icvRaw)
      : (viag_prog > 0 ? viagens / viag_prog : 0);
    return { date, viag_prog, viagens, supressao, icv };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log("Baixando planilha ICV...");
  const response = await fetch(CSV_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ao acessar planilha ICV`);
  const text = await response.text();
  if (/accounts\.google\.com|ServiceLogin|<html/i.test(text)) {
    throw new Error("Planilha ICV precisa estar publicada ou compartilhada para leitura por link.");
  }
  const dados = normalizeRows(parseCsv(text));
  if (!dados.length) throw new Error("Nenhum registro válido na planilha ICV.");
  const payload = {
    atualizadoEm: new Date().toISOString(),
    total: dados.length,
    fonte: CSV_URL.split("?")[0],
    dados
  };
  fs.writeFileSync(path.join(outputDir, "dados.json"), JSON.stringify(payload), "utf8");
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({
    atualizadoEm: payload.atualizadoEm,
    total: payload.total,
    arquivo: "dados.json"
  }), "utf8");
  console.log(`ICV salvo (${dados.length} registro(s)).`);
}

main().catch((error) => {
  console.error("Falha ao atualizar ICV:", error.message || error);
  process.exit(1);
});
