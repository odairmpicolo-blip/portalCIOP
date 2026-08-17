/**
 * Exporta o histórico do cr_0002 (tudo antes do mês atual) para
 * assets/data/incidentes-cad.json. O mês vigente continua no banco.
 *
 * Uso:
 *   DSQL_CLUSTER_ID=ort34httzig7iktrneb4ytcy5u DSQL_REGION=sa-east-1 DSQL_USER=admin \
 *     node scripts/atualizar-incidentes-cad-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../backend/src/db.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "assets/data/incidentes-cad.json");

function mesAtualInicio() {
  const br = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return `${br.slice(0, 7)}-01`;
}

function citar(nome) {
  const n = String(nome || "");
  if (/^[a-z_][a-z0-9_]*$/i.test(n)) return n;
  return `"${n.replace(/"/g, "")}"`;
}

function cadValor(v, profundidade = 0) {
  if (v == null) return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.length > 4000 ? `${v.slice(0, 4000)}…` : v;
  if (Array.isArray(v)) return profundidade > 2 ? v.slice(0, 20).map(String) : v.slice(0, 80).map((x) => cadValor(x, profundidade + 1));
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

async function main() {
  const inicioMes = mesAtualInicio();
  let colunas = [];
  try {
    const c = await query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'cr_0002'
       ORDER BY ordinal_position`
    );
    colunas = c.rows
      .filter((r) => !/bytea|xml/i.test(r.data_type || "") && !/html|foto|image|blob/i.test(r.column_name))
      .map((r) => r.column_name);
  } catch (err) {
    console.warn("information_schema indisponível:", err.message);
  }
  const dataCol = colunas.find((n) => /^(data_ref|data|dt|date)$/i.test(n))
    || colunas.find((n) => /data|date|dia/i.test(n));
  const lista = colunas.length ? colunas.map(citar).join(", ") : "*";
  const where = dataCol ? ` WHERE ${citar(dataCol)}::text < $1` : "";
  const sql = `SELECT ${lista} FROM cr_0002${where}`;
  const r = await query(sql, dataCol ? [inicioMes] : []);
  const itens = (r.rows || []).map((row) => {
    let extra = row.payload;
    if (typeof extra === "string") {
      try { extra = JSON.parse(extra); } catch (_) { extra = null; }
    }
    const merged = extra && typeof extra === "object" && !Array.isArray(extra) ? { ...row, ...extra } : { ...row };
    delete merged.payload;
    return cadValor(merged);
  });
  const snapshot = {
    ok: true,
    origem: "arquivo",
    fonte: "CR-002",
    tabela: "cr_0002",
    recorte: "historico",
    atualizadoEm: new Date().toISOString(),
    meta: {
      de: null,
      ate: dataCol ? inicioMes : null,
      total: itens.length,
      nota: `Registros anteriores a ${inicioMes}. O mês atual vem do banco.`
    },
    colunas: colunas.length ? colunas : (itens[0] ? Object.keys(itens[0]) : []),
    itens
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(snapshot)}\n`);
  console.log(`Incidentes CAD JSON: ${itens.length} registro(s) anteriores a ${inicioMes}`);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  try { await closePool(); } catch (_) { /* ignore */ }
  process.exit(1);
});
