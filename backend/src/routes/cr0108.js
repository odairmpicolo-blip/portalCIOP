import { Router } from "express";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";

/**
 * CR-0108 direto do Aurora DSQL.
 *
 * A tabela cr0108_passagem guarda a passagem crua (uma linha por passagem por ponto
 * de controle). Estas rotas devolvem os MESMOS formatos que a página já consumia dos
 * JSONs estáticos, só que com o recorte de data aplicado no banco — que é o que os
 * arquivos mensais não davam.
 *
 * Régua do CIOP, gravada na coluna `classe` na importação:
 *   -2..+6 = noHorario | -10..-3 = adiantado | +7..+15 = atrasado | resto = divergente
 * Passagens sem diferença legível ficam com classe NULL e entram só em `semDif`.
 */

const router = Router();

/* Bloco de agregação reaproveitado por todas as rotas. Mantém exatamente os mesmos
   nomes de campo dos JSONs antigos para a página não precisar traduzir nada. */
const AGG = `
  count(*)                                                    AS total,
  count(*) FILTER (WHERE classe = 'noHorario')                AS "noHorario",
  count(*) FILTER (WHERE classe = 'adiantado')                AS adiantado,
  count(*) FILTER (WHERE classe = 'atrasado')                 AS atrasado,
  count(*) FILTER (WHERE classe = 'divergente')               AS divergente,
  coalesce(sum(diferenca_min) FILTER (WHERE classe IS NOT NULL), 0) AS "somaDif",
  count(*) FILTER (WHERE classe IS NULL)                      AS "semDif"
`;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Monta o WHERE a partir dos filtros da query string, sempre parametrizado. */
function filtros(req, extras = {}) {
  const cond = [];
  const par = [];
  const add = (sql, valor) => { par.push(valor); cond.push(sql.replace("?", `$${par.length}`)); };

  const de = String(req.query.de || "");
  const ate = String(req.query.ate || "");
  if (ISO.test(de)) add("data >= ?::date", de);
  if (ISO.test(ate)) add("data <= ?::date", ate);

  if (req.query.linha) add("linha = ?", String(req.query.linha));
  if (req.query.sentido) add("sentido = ?", String(req.query.sentido));
  if (req.query.garagem) add("garagem = ?", String(req.query.garagem));
  for (const [coluna, valor] of Object.entries(extras)) {
    if (valor) add(`${coluna} = ?`, String(valor));
  }

  return { where: cond.length ? `WHERE ${cond.join(" AND ")}` : "", par };
}

function erro(res, err) {
  console.error("cr0108:", err);
  res.status(500).json({ ok: false, erro: err.message });
}

/* ------------------------------------------------------------------ meta */
router.get("/meta", requireFirebaseUser, async (_req, res) => {
  try {
    const [periodo, linhas] = await Promise.all([
      query(`SELECT min(data)::text AS "primeiroDia", max(data)::text AS "ultimoDia",
                    count(*) AS registros, count(DISTINCT data) AS dias
             FROM cr0108_passagem`),
      query(`SELECT linha, max(linha_nome) AS nome, count(*) AS total
             FROM cr0108_passagem GROUP BY linha ORDER BY linha`)
    ]);
    const p = periodo.rows[0] || {};
    res.json({
      ok: true,
      origem: "dsql",
      primeiroDia: p.primeiroDia,
      ultimoDia: p.ultimoDia,
      registros: Number(p.registros || 0),
      dias: Number(p.dias || 0),
      linhas: Object.fromEntries(linhas.rows.map(r => [r.linha, r.nome || ""]))
    });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ evolução por dia */
router.get("/serie", requireFirebaseUser, async (req, res) => {
  try {
    const { where, par } = filtros(req);
    const r = await query(
      `SELECT data::text AS data, ${AGG} FROM cr0108_passagem ${where} GROUP BY data ORDER BY data`,
      par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ ranking */
const DIMENSOES = {
  linha:    { col: "linha",          rotulo: "linha",     extra: "max(linha_nome)" },
  ponto:    { col: "ponto_controle", rotulo: "ponto",     extra: "NULL" },
  operador: { col: "operador_mat",   rotulo: "matricula", extra: "max(operador_nome)" },
  veiculo:  { col: "veiculo",        rotulo: "veiculo",   extra: "NULL" },
  garagem:  { col: "garagem",        rotulo: "garagem",   extra: "NULL" },
  bloco:    { col: "bloco",          rotulo: "servico",   extra: "NULL" }
};

router.get("/ranking", requireFirebaseUser, async (req, res) => {
  const dim = DIMENSOES[String(req.query.dim || "linha")];
  if (!dim) {
    res.status(400).json({ ok: false, erro: "dim inválida" });
    return;
  }
  try {
    const { where, par } = filtros(req);
    const limite = Math.min(Number(req.query.limite) || 500, 2000);
    const r = await query(
      `SELECT ${dim.col} AS chave, ${dim.extra} AS nome, ${AGG}
       FROM cr0108_passagem ${where}
       GROUP BY ${dim.col}
       ORDER BY total DESC
       LIMIT ${limite}`,
      par
    );
    res.json({ ok: true, origem: "dsql", dimensao: dim.rotulo, itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ faixa horária */
router.get("/hora", requireFirebaseUser, async (req, res) => {
  try {
    const { where, par } = filtros(req);
    const r = await query(
      `SELECT coalesce(lpad(hora_programada::text, 2, '0'), '??') AS hora, ${AGG}
       FROM cr0108_passagem ${where} GROUP BY hora ORDER BY hora`,
      par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ cascata: pontos de uma linha */
router.get("/pontos", requireFirebaseUser, async (req, res) => {
  if (!req.query.linha) {
    res.status(400).json({ ok: false, erro: "informe a linha" });
    return;
  }
  try {
    const { where, par } = filtros(req);
    const r = await query(
      `SELECT ponto_controle AS ponto, sentido, ${AGG}
       FROM cr0108_passagem ${where}
       GROUP BY ponto_controle, sentido
       ORDER BY (count(*) - count(*) FILTER (WHERE classe = 'noHorario')) DESC`,
      par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ cascata: horários de um ponto
   Devolve, além dos contadores, o histograma de desvios de cada horário. O cálculo do
   melhor deslocamento (-20..+20) continua no navegador: são poucos milissegundos lá e
   evita jogar 41 varreduras por horário para dentro do banco. */
router.get("/horarios", requireFirebaseUser, async (req, res) => {
  if (!req.query.linha || !req.query.ponto) {
    res.status(400).json({ ok: false, erro: "informe linha e ponto" });
    return;
  }
  try {
    const { where, par } = filtros(req, { ponto_controle: req.query.ponto });
    const r = await query(
      `SELECT programado, sentido, ${AGG},
              array_agg(diferenca_min) FILTER (WHERE classe IS NOT NULL) AS desvios
       FROM cr0108_passagem ${where}
       GROUP BY programado, sentido
       ORDER BY programado`,
      par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

export default router;
