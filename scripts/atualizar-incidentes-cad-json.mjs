/**
 * Exporta o cr_0002 do ano corrente (já no DSQL) para assets/data/incidentes-cad.json.
 * O mês vigente continua sendo lido ao vivo pela API; o JSON cobre o ano todo
 * para o Pages não depender só do banco.
 *
 * Uso:
 *   DSQL_CLUSTER_ID=… DSQL_REGION=sa-east-1 DSQL_USER=admin \
 *     node scripts/atualizar-incidentes-cad-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../backend/src/db.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/data/incidentes-cad.json");
const PAGE = Math.min(Math.max(Number(process.env.CAD_JSON_PAGE) || 400, 50), 800);

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function intervaloAno() {
  const hoje = hojeSP();
  const ano = String(process.env.CAD_JSON_ANO || hoje.slice(0, 4));
  return { de: `${ano}-01-01`, ate: `${ano}-12-31`, ano };
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

async function main() {
  const { de, ate, ano } = intervaloAno();
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

  const snapshot = {
    ok: true,
    origem: "arquivo",
    fonte: "CR-002",
    tabela: "cr_0002",
    recorte: "ano",
    atualizadoEm: new Date().toISOString(),
    meta: {
      de,
      ate,
      ano,
      total: itens.length,
      nota: `Ano ${ano} já carregado no cr_0002. O mês atual também vem da API.`
    },
    colunas: itens[0] ? Object.keys(itens[0]) : [],
    itens
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
  console.log(`Incidentes CAD JSON: ${itens.length} registro(s) de ${de} a ${ate}`);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  try { await closePool(); } catch (_) { /* ignore */ }
  process.exit(1);
});
