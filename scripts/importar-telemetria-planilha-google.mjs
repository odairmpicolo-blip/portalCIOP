/**
 * Importa abas Clever, TCGL e FleetBus da planilha Google → assets/data/telemetria/dados.json
 *
 * Uso (XLSX exportado do Google — Arquivo → Fazer download → Excel):
 *   node scripts/importar-telemetria-planilha-google.mjs --arquivo ~/Downloads/planilha.xlsx
 *
 * Uso (planilha pública — qualquer pessoa com o link pode ver):
 *   node scripts/importar-telemetria-planilha-google.mjs
 *
 * Opções:
 *   --sheet-id ID     (padrão: planilha TCGL telemetria)
 *   --gid-clever GID  --gid-tcgl GID  --gid-fleetbus GID
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  converterPlanilha,
  linhasParaRegistros
} from "./lib/telemetria-planilha-parse.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "assets/data/telemetria");
const DEFAULT_SHEET_ID = "1Z_rFA-1jz7-kq4juGp5uFG4WMpVBloML98hDgWcX9gQ";
const DEFAULT_GID_CLEVER = "0";
const DEFAULT_GID_TCGL = "1112924394";
const DEFAULT_GID_FLEETBUS = "1035972881";

function parseArgs(argv) {
  const opts = { sheetId: DEFAULT_SHEET_ID };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--arquivo") opts.arquivo = argv[++i];
    else if (a === "--sheet-id") opts.sheetId = argv[++i];
    else if (a === "--gid-clever") opts.gidClever = argv[++i];
    else if (a === "--gid-tcgl") opts.gidTcgl = argv[++i];
    else if (a === "--gid-fleetbus") opts.gidFleetbus = argv[++i];
    else if (!a.startsWith("-")) opts.arquivo = a;
  }
  return opts;
}

async function baixarCsv(sheetId, gid, nomeAba) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith("<!DOCTYPE")) {
    throw new Error(`Não foi possível baixar aba ${nomeAba} (gid=${gid}). Publique a planilha ou use --arquivo.`);
  }
  return text;
}

function parseCsv(texto) {
  const src = texto.replace(/^\uFEFF/, "");
  const linhas = [];
  let row = [];
  let cell = "";
  let emAspas = false;
  const pushCell = () => { row.push(cell); cell = ""; };
  const pushRow = () => {
    if (row.length > 1 || row[0] !== "" || cell) pushCell();
    if (row.some((x) => String(x).trim() !== "")) linhas.push(row);
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];
    if (emAspas) {
      if (c === "\"" && next === "\"") { cell += "\""; i++; }
      else if (c === "\"") emAspas = false;
      else cell += c;
      continue;
    }
    if (c === "\"") { emAspas = true; continue; }
    if (c === "\r") continue;
    if (c === "\n") { pushCell(); pushRow(); continue; }
    if (c === "," || c === ";") { pushCell(); continue; }
    cell += c;
  }
  if (cell.length || row.length) { pushCell(); pushRow(); }
  return linhas;
}

function lerAbaXlsx(wb, nomesPossiveis) {
  const alvo = nomesPossiveis.map((n) => n.toLowerCase());
  const nome = wb.SheetNames.find((s) => alvo.includes(s.toLowerCase()));
  if (!nome) return null;
  const sheet = wb.Sheets[nome];
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  return converterPlanilha(linhas);
}

async function carregarFonte(opts, fonte, gid, nomesAba) {
  if (opts.arquivo) {
    const buf = fs.readFileSync(path.resolve(opts.arquivo));
    const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
    const parsed = lerAbaXlsx(wb, nomesAba);
    if (!parsed?.rows?.length) {
      console.warn(`Aba ${fonte}: sem dados em ${opts.arquivo}`);
      return [];
    }
    return linhasParaRegistros(parsed.rows, parsed.headers, fonte, path.basename(opts.arquivo));
  }
  if (!gid) throw new Error(`Informe --gid-${fonte} ou use --arquivo com abas ${nomesAba.join("/")}`);
  const csv = await baixarCsv(opts.sheetId, gid, fonte);
  const parsed = converterPlanilha(parseCsv(csv));
  return linhasParaRegistros(parsed.rows, parsed.headers, fonte, `google-sheet-${fonte}`);
}

async function main() {
  const opts = parseArgs(process.argv);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let clever = [];
  let tcgl = [];
  let fleetbus = [];

  try {
    clever = await carregarFonte(opts, "clever", opts.gidClever || DEFAULT_GID_CLEVER, ["Clever", "CLEVER", "clever"]);
    tcgl = await carregarFonte(opts, "tcgl", opts.gidTcgl || DEFAULT_GID_TCGL, ["TCGL", "Tcgl", "tcgl"]);
  } catch (err) {
    if (!opts.arquivo) {
      console.error(err.message);
      console.error("\nExporte a planilha como XLSX e rode:");
      console.error("  node scripts/importar-telemetria-planilha-google.mjs --arquivo caminho/planilha.xlsx");
      process.exit(1);
    }
    throw err;
  }

  try {
    fleetbus = await carregarFonte(opts, "fleetbus", opts.gidFleetbus || DEFAULT_GID_FLEETBUS, ["Fleetbus", "FLEETBUS", "FleetBus", "fleetbus"]);
  } catch (err) {
    console.warn(`FleetBus: ${err.message || err} — continuando sem FleetBus.`);
  }

  const dados = [...clever, ...tcgl, ...fleetbus].sort((a, b) =>
    a.data_iso.localeCompare(b.data_iso) || a.veiculo.localeCompare(b.veiculo, "pt-BR", { numeric: true })
  );
  const datas = [...new Set(dados.map((d) => d.data_iso))].sort();
  const atualizadoEm = new Date().toISOString();

  const snapshot = {
    atualizadoEm,
    origem: opts.arquivo ? "arquivo-local" : "google-sheets",
    planilhaId: opts.sheetId,
    fontes: ["clever", "tcgl", "fleetbus"],
    total: dados.length,
    total_clever: clever.length,
    total_tcgl: tcgl.length,
    total_fleetbus: fleetbus.length,
    data_de: datas[0] || null,
    data_ate: datas[datas.length - 1] || null,
    dados
  };

  const manifest = {
    atualizadoEm,
    arquivo: "dados.json",
    origem: snapshot.origem,
    total: dados.length,
    total_clever: clever.length,
    total_tcgl: tcgl.length,
    total_fleetbus: fleetbus.length,
    data_de: snapshot.data_de,
    data_ate: snapshot.data_ate
  };

  fs.writeFileSync(path.join(OUT_DIR, "dados.json"), JSON.stringify(snapshot) + "\n");
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`Clever:   ${clever.length} registro(s)`);
  console.log(`TCGL:     ${tcgl.length} registro(s)`);
  console.log(`FleetBus: ${fleetbus.length} registro(s)`);
  console.log(`Total:    ${dados.length} → ${OUT_DIR}/dados.json`);
  if (datas.length) console.log(`Período: ${datas[0]} a ${datas[datas.length - 1]}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
