/**
 * Gera os JSON do dashboard de Liberação a partir do Aurora DSQL.
 * A página pinta esses arquivos na hora, sem esperar a planilha.
 *
 *   DSQL_CLUSTER_ID=… AWS_ACCESS_KEY_ID=… node scripts/exportar-liberacao-graficos-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../backend/src/db.js";
import { agregarLiberacao, somarCategoriasLiberacao } from "../backend/src/lib/liberacao-graficos.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/data/liberacao");
const TZ = process.env.PORTAL_TZ || "America/Sao_Paulo";
const DIAS_HIST = Math.max(14, Number(process.env.LIBERACAO_GRAFICOS_DIAS || 40));

function isoHoje() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (t) => partes.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isoOffset(iso, dias) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

function gravar(nome, obj) {
  fs.mkdirSync(DIR, { recursive: true });
  const p = path.join(DIR, nome);
  fs.writeFileSync(p, JSON.stringify(obj));
  const kb = (fs.statSync(p).size / 1024).toFixed(1);
  console.log(`  ${nome}: ${kb} KB`);
}

function payloadRow(row) {
  let p = row.payload;
  if (typeof p === "string") {
    try { p = JSON.parse(p); } catch (_) { p = {}; }
  }
  return p && typeof p === "object" ? p : {};
}

async function main() {
  const hoje = isoHoje();
  const de = isoOffset(hoje, -(DIAS_HIST - 1));
  const atualizadoEm = new Date().toISOString();
  console.log(`Exportando gráficos de liberação ${de} a ${hoje}…`);

  const r = await query(
    `SELECT data_iso::text AS data, payload
     FROM liberacao_linhas
     WHERE data_iso >= $1::date AND data_iso <= $2::date
     ORDER BY data_iso, row_id`,
    [de, hoje]
  );

  const porDia = new Map();
  for (const row of r.rows) {
    const dia = String(row.data || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(payloadRow(row));
  }

  const graficosDias = {};
  for (const [dia, dados] of [...porDia.entries()].sort()) {
    const arquivo = `graficos-dia-${dia}.json`;
    const categorias = agregarLiberacao(dados);
    gravar(arquivo, {
      ok: true,
      data_de: dia,
      data_ate: dia,
      categorias,
      total_linhas: dados.length,
      origem: "dsql",
      atualizadoEm
    });
    graficosDias[dia] = { arquivo, total_linhas: dados.length };
  }

  function faixa(id, dataDe, dataAte, arquivo) {
    const dias = [];
    for (let d = dataDe; d <= dataAte; d = isoOffset(d, 1)) {
      if (porDia.has(d)) dias.push(d);
    }
    const dados = dias.flatMap((d) => porDia.get(d) || []);
    const categorias = somarCategoriasLiberacao(dias.map((d) => agregarLiberacao(porDia.get(d) || [])));
    gravar(arquivo, {
      ok: true,
      data_de: dataDe,
      data_ate: dataAte,
      categorias,
      total_linhas: dados.length,
      origem: "dsql",
      atualizadoEm
    });
    return { arquivo, data_de: dataDe, data_ate: dataAte, total_linhas: dados.length };
  }

  const graficos = {
    hoje: faixa("hoje", hoje, hoje, "graficos-hoje.json"),
    "7d": faixa("7d", isoOffset(hoje, -7), hoje, "graficos-7d.json"),
    "30d": faixa("30d", isoOffset(hoje, -30), hoje, "graficos-30d.json")
  };

  const manifestPath = path.join(DIR, "manifest.json");
  let manifest = {};
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch (_) { /* novo */ }
  manifest.atualizadoEm = atualizadoEm;
  manifest.graficos = graficos;
  manifest.graficosDias = graficosDias;
  gravar("manifest.json", manifest);
  console.log(`Pronto: ${porDia.size} dia(s), ${r.rows.length} linha(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
