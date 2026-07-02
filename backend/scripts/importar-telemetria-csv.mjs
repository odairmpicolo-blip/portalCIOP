/**
 * Importa CSV(s) Clever/TCGL direto no Aurora DSQL (sem API Gateway).
 *
 * Uso:
 *   DSQL_CLUSTER_ID=ort34httzig7iktrneb4ytcy5u DSQL_REGION=sa-east-1 \
 *     node backend/scripts/importar-telemetria-csv.mjs /caminho/pasta-ou-arquivo.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../src/db.js";
import {
  agregarLinhasTelemetria,
  mesclarLinhasTelemetria,
  nomeColunaClever,
  normChaveMerge
} from "../src/lib/telemetria-merge.js";

const LOTE_UPSERT = 80;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "../..");

function normChave(s) {
  return normChaveMerge(s);
}

function normVeiculo(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits) return String(parseInt(digits, 10));
  return s.toUpperCase();
}

function parseDataCsv(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
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

function converterCsv(texto) {
  const linhas = parseCsv(texto);
  if (!linhas.length) return { headers: [], rows: [] };
  const pares = [];
  linhas[0].forEach((h, i) => {
    const col = nomeColunaClever(String(h).trim());
    if (col) pares.push({ i, col });
  });
  const rows = linhas.slice(1).map((cols) => {
    const obj = {};
    pares.forEach(({ i, col }) => {
      obj[col] = cols[i] != null ? String(cols[i]).trim() : "";
    });
    return obj;
  });
  return { headers: [...new Set(pares.map((p) => p.col))], rows };
}

function detectarColunaVeiculo(headers) {
  const chaves = ["veiculo", "vehicle id", "vehicle", "carro", "prefixo"];
  for (const h of headers) {
    const n = normChave(h);
    if (chaves.some((k) => n === k || n.includes(k))) return h;
  }
  return headers[0] || "";
}

function detectarColunaData(headers) {
  const chaves = ["data", "date", "dia"];
  for (const h of headers) {
    const n = normChave(h);
    if (chaves.some((k) => n === k || n.startsWith(k))) return h;
  }
  return "";
}

function unificar(rows, colVeiculo, colData) {
  const grupos = new Map();
  rows.forEach((row) => {
    const dataIso = parseDataCsv(row[colData]);
    const veiculo = normVeiculo(row[colVeiculo]);
    if (!dataIso || !veiculo) return;
    const key = `${dataIso}|${veiculo}`;
    const payload = { ...row, data_iso: dataIso, veiculo_norm: veiculo };
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(payload);
  });
  const map = new Map();
  for (const [key, grupo] of grupos) {
    map.set(key, agregarLinhasTelemetria(grupo));
  }
  return map;
}

async function buscarExistentes(chaves) {
  const mapa = new Map();
  for (let i = 0; i < chaves.length; i += 200) {
    const lote = chaves.slice(i, i + 200);
    const params = [];
    const tuples = lote.map(([dataIso, veiculo], idx) => {
      const a = idx * 2 + 1;
      params.push(dataIso, veiculo);
      return `($${a}::date, $${a + 1})`;
    }).join(", ");
    const res = await query(
      `SELECT data_iso, veiculo, payload FROM telemetria_linhas WHERE (data_iso, veiculo) IN (${tuples})`,
      params
    );
    res.rows.forEach((r) => {
      const iso = String(r.data_iso).slice(0, 10);
      mapa.set(`${iso}|${r.veiculo}`, r.payload);
    });
  }
  return mapa;
}

async function upsertLote(regs, origem) {
  if (!regs.length) return 0;
  const params = [];
  const values = regs.map((reg, idx) => {
    const base = idx * 5;
    params.push(reg.dataIso, reg.veiculo, JSON.stringify(reg.payload), origem, "import-csv-cli");
    return `($${base + 1}::date, $${base + 2}, $${base + 3}::jsonb, $${base + 4}, $${base + 5}, NOW())`;
  }).join(", ");
  await query(
    `INSERT INTO telemetria_linhas (data_iso, veiculo, payload, origem_arquivo, atualizado_por, atualizado_em)
     VALUES ${values}
     ON CONFLICT (data_iso, veiculo) DO UPDATE SET
       payload = EXCLUDED.payload,
       origem_arquivo = EXCLUDED.origem_arquivo,
       atualizado_por = EXCLUDED.atualizado_por,
       atualizado_em = NOW()`,
    params
  );
  return regs.length;
}

function listarArquivos(alvo) {
  const st = fs.statSync(alvo);
  if (st.isFile()) return [alvo];
  return fs.readdirSync(alvo)
    .filter((f) => /\.csv$/i.test(f))
    .map((f) => path.join(alvo, f))
    .sort();
}

async function importarArquivo(arquivo) {
  const nome = path.basename(arquivo);
  const texto = fs.readFileSync(arquivo, "utf8");
  const { headers, rows } = converterCsv(texto);
  if (!rows.length) {
    console.warn(`  ${nome}: sem linhas`);
    return 0;
  }
  const colVeiculo = detectarColunaVeiculo(headers);
  const colData = detectarColunaData(headers);
  if (!colVeiculo || !colData) {
    console.warn(`  ${nome}: colunas veículo/data não detectadas`);
    return 0;
  }
  const mapa = unificar(rows, colVeiculo, colData);
  const chaves = [...mapa.keys()].map((k) => k.split("|"));
  const existentes = await buscarExistentes(chaves);
  const registros = [...mapa.entries()].map(([key, payload]) => {
    const [dataIso, veiculo] = key.split("|");
    const final = existentes.has(key)
      ? mesclarLinhasTelemetria(existentes.get(key), payload)
      : payload;
    return { dataIso, veiculo, payload: final };
  });
  let n = 0;
  for (let i = 0; i < registros.length; i += LOTE_UPSERT) {
    n += await upsertLote(registros.slice(i, i + LOTE_UPSERT), nome);
  }
  console.log(`  ${nome}: ${n} registro(s) veículo/dia`);
  return n;
}

async function main() {
  const alvo = process.argv[2];
  if (!alvo || !fs.existsSync(alvo)) {
    console.error("Uso: node importar-telemetria-csv.mjs <pasta-ou-arquivo.csv>");
    process.exit(1);
  }
  const arquivos = listarArquivos(alvo);
  if (!arquivos.length) {
    console.error("Nenhum .csv encontrado.");
    process.exit(1);
  }
  console.log(`Importando ${arquivos.length} arquivo(s)…`);
  let total = 0;
  for (const arq of arquivos) {
    total += await importarArquivo(arq);
  }
  const res = await query("SELECT COUNT(*)::int AS n FROM telemetria_linhas");
  console.log(`Concluído: ${total} upsert(s) · total no banco: ${res.rows[0].n}`);
  await closePool();

  const jsonScript = path.join(REPO_ROOT, "scripts/atualizar-telemetria-json.mjs");
  if (fs.existsSync(jsonScript)) {
    console.log("Atualizando snapshot JSON para GitHub Pages…");
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [jsonScript], { cwd: REPO_ROOT, stdio: "inherit", env: process.env });
    if (r.status !== 0) console.warn("Aviso: snapshot JSON não foi gerado (import no DSQL concluído).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
