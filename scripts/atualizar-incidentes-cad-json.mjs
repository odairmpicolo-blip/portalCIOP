/**
 * Atualiza o JSON do CAD (cr_0002).
 *
 * Padrão (fim de mês / cron no dia 1): puxa o mês que acabou de fechar,
 * grava assets/data/incidentes-cad/YYYY-MM.json e mescla em
 * assets/data/incidentes-cad.json. O mês vigente continua na API.
 *
 *   node scripts/atualizar-incidentes-cad-json.mjs
 *   CAD_JSON_MES=2026-07 node scripts/atualizar-incidentes-cad-json.mjs
 *   CAD_JSON_MODO=ano node scripts/atualizar-incidentes-cad-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../backend/src/db.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/data/incidentes-cad.json");
const DIR_MESES = path.join(ROOT, "assets/data/incidentes-cad");
const PAGE = Math.min(Math.max(Number(process.env.CAD_JSON_PAGE) || 400, 50), 800);

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function ultimoDia(y, m) {
  return new Date(Number(y), Number(m), 0).getDate();
}

function mesAtualInicio(hoje = hojeSP()) {
  return `${hoje.slice(0, 7)}-01`;
}

function mesFechado(hoje = hojeSP()) {
  const forcado = String(process.env.CAD_JSON_MES || "").trim();
  if (/^\d{4}-\d{2}$/.test(forcado)) {
    const [y, m] = forcado.split("-");
    const ateDia = String(ultimoDia(y, m)).padStart(2, "0");
    return { de: `${forcado}-01`, ate: `${forcado}-${ateDia}`, chave: forcado };
  }
  const [y, m] = hoje.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const ateDia = String(ultimoDia(yy, mm)).padStart(2, "0");
  return { de: `${yy}-${mm}-01`, ate: `${yy}-${mm}-${ateDia}`, chave: `${yy}-${mm}` };
}

function intervaloAno() {
  const hoje = hojeSP();
  const ano = String(process.env.CAD_JSON_ANO || hoje.slice(0, 4));
  const inicioMes = mesAtualInicio(hoje);
  return { de: `${ano}-01-01`, ate: diaAnterior(inicioMes), ano, chave: ano };
}

function diaAnterior(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function dataIsoLinha(row) {
  const bruto = row?.data_ref ?? row?.data ?? "";
  if (bruto instanceof Date && !Number.isNaN(bruto.getTime())) return bruto.toISOString().slice(0, 10);
  const t = String(bruto).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return "";
}

function chaveLinha(row) {
  const id = String(row?.id ?? row?.id_incidente ?? "").trim();
  if (id) return `id:${id}`;
  return [dataIsoLinha(row), row?.hora || "", row?.veiculo || "", row?.linha || ""].join("|");
}

function cadValor(v, profundidade = 0) {
  if (v == null) return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.length > 4000 ? `${v.slice(0, 4000)}…` : v;
  if (Array.isArray(v)) {
    return profundidade > 2
      ? v.slice(0, 20).map(String)
      : v.slice(0, 80).map((x) => cadValor(x, profundidade + 1));
  }
  if (typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (/html|xml|foto|image|blob|bytea/i.test(k)) continue;
      const n = cadValor(val, profundidade + 1);
      if (n !== undefined) o[k] = n;
    }
    return o;
  }
  return v;
}

function linhaCad(row) {
  let extra = row.payload;
  if (typeof extra === "string") {
    try { extra = JSON.parse(extra); } catch (_) { extra = null; }
  }
  const merged = extra && typeof extra === "object" && !Array.isArray(extra)
    ? { ...row, ...extra }
    : { ...row };
  delete merged.payload;
  return cadValor(merged);
}

async function lerPaginas(de, ate) {
  const itens = [];
  let offset = 0;
  let pagina = 0;
  while (true) {
    pagina += 1;
    const r = await query(
      `SELECT * FROM cr_0002
       WHERE data_ref >= $1::date AND data_ref <= $2::date
       ORDER BY id
       LIMIT ${PAGE} OFFSET ${offset}`,
      [de, ate]
    );
    const lote = (r.rows || []).map(linhaCad);
    itens.push(...lote);
    console.log(`  página ${pagina}: +${lote.length} (total ${itens.length})`);
    if (lote.length < PAGE) break;
    offset += PAGE;
    if (pagina > 500) throw new Error("teto de páginas no export CAD");
  }
  return itens;
}

function lerJsonAtual() {
  try {
    const raw = fs.readFileSync(OUT, "utf8");
    const d = JSON.parse(raw);
    return Array.isArray(d?.itens) ? d.itens : [];
  } catch {
    return [];
  }
}

function mesclar(historico, novos, de, ate) {
  const mapa = new Map();
  for (const row of historico) {
    const iso = dataIsoLinha(row);
    if (iso && iso >= de && iso <= ate) continue;
    mapa.set(chaveLinha(row), row);
  }
  for (const row of novos) mapa.set(chaveLinha(row), row);
  return [...mapa.values()];
}

function gravarSnapshot(itens, meta) {
  const snapshot = {
    ok: true,
    origem: "arquivo",
    fonte: "CR-002",
    tabela: "cr_0002",
    recorte: meta.recorte,
    atualizadoEm: new Date().toISOString(),
    meta: {
      de: meta.de,
      ate: meta.ate,
      ano: meta.ano || meta.chave?.slice(0, 4),
      mesFechado: meta.chave,
      total: itens.length,
      nota: meta.nota
    },
    colunas: itens[0] ? Object.keys(itens[0]) : [],
    itens
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
}

function gravarMes(chave, itens, de, ate) {
  fs.mkdirSync(DIR_MESES, { recursive: true });
  const dest = path.join(DIR_MESES, `${chave}.json`);
  fs.writeFileSync(dest, `${JSON.stringify({
    ok: true,
    origem: "arquivo",
    fonte: "CR-002",
    tabela: "cr_0002",
    recorte: "mes-fechado",
    atualizadoEm: new Date().toISOString(),
    meta: { de, ate, mes: chave, total: itens.length },
    colunas: itens[0] ? Object.keys(itens[0]) : [],
    itens
  })}\n`);
  return dest;
}

async function main() {
  const modo = String(process.env.CAD_JSON_MODO || "mes-fechado").toLowerCase();
  if (modo === "ano") {
    const { de, ate, ano } = intervaloAno();
    const itens = await lerPaginas(de, ate);
    gravarSnapshot(itens, {
      recorte: "ano-fechado",
      de,
      ate,
      ano,
      chave: ano,
      nota: `Ano ${ano} até o último dia do mês anterior. O mês atual vem da API.`
    });
    console.log(`Incidentes CAD JSON (ano): ${itens.length} registro(s) de ${de} a ${ate}`);
    await closePool();
    return;
  }

  const { de, ate, chave } = mesFechado();
  const novos = await lerPaginas(de, ate);
  const arquivoMes = gravarMes(chave, novos, de, ate);
  const juntos = mesclar(lerJsonAtual(), novos, de, ate);
  const datas = juntos.map(dataIsoLinha).filter(Boolean).sort();
  gravarSnapshot(juntos, {
    recorte: "meses-fechados",
    de: datas[0] || de,
    ate: datas[datas.length - 1] || ate,
    chave,
    nota: `Mês ${chave} fechado no JSON. O mês atual vem da API.`
  });
  console.log(`Mês fechado ${chave}: ${novos.length} registro(s) → ${arquivoMes}`);
  console.log(`JSON consolidado: ${juntos.length} registro(s)`);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  try { await closePool(); } catch (_) { /* ignore */ }
  process.exit(1);
});
