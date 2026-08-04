import { Router } from "express";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";

/**
 * CR-0108, ICV e IPV lidos direto do Aurora DSQL.
 *
 * TABELAS REAIS (conferidas no console, não presumidas):
 *   cr_0108              passagem crua, uma linha por passagem por ponto de controle.
 *                        Todas as colunas de negócio são TEXT.
 *   cr_0108_cargas       controle de carga por dia (data_ref, status, linhas). Minúscula,
 *                        e por isso é dela que sai o /meta — contar 2,3 mi levaria 30 s.
 *   cr_custom            ICV e IPV por dia.
 *   cr_custom_ontime     IPV detalhado por dia.
 *
 * A coluna `diferenca` vem como hora com sinal ("-00:09", "00:00", "00:11"), então
 * precisa virar minutos antes de qualquer conta. A conversão abaixo foi validada
 * contra os 2.335.186 registros até 30/07: os seis totais bateram na unidade com os
 * agregados publicados (2.138.906 no horário, 112.633 adiantado, 77.155 atrasado,
 * 6.492 divergente, desvio médio 0,94).
 *
 * As colunas `status` e `otp_status` da tabela existem mas NÃO são usadas: a régua é a
 * do CIOP, aplicada sobre os minutos.
 */

const router = Router();

/* Hora com sinal -> minutos. O ltrim tira o menos antes de fatiar; o sinal volta
   multiplicando. O regex protege contra célula vazia ou texto solto, que viram NULL. */
const MIN = `
  CASE WHEN diferenca ~ '^-?[0-9]+:[0-9][0-9]'
  THEN (CASE WHEN left(diferenca, 1) = '-' THEN -1 ELSE 1 END) *
       (split_part(ltrim(diferenca, '-'), ':', 1)::int * 60 +
        split_part(ltrim(diferenca, '-'), ':', 2)::int)
  END`;

/* Régua do CIOP. Mantém os mesmos nomes de campo dos JSONs para a página não traduzir. */
const AGG = `
  count(*)                                              AS total,
  count(*) FILTER (WHERE m BETWEEN -2 AND 6)            AS "noHorario",
  count(*) FILTER (WHERE m BETWEEN -10 AND -3)          AS adiantado,
  count(*) FILTER (WHERE m BETWEEN 7 AND 15)            AS atrasado,
  count(*) FILTER (WHERE m >= 16 OR m <= -11)           AS divergente,
  coalesce(sum(m), 0)                                   AS "somaDif",
  count(*) FILTER (WHERE m IS NULL)                     AS "semDif"`;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* Acima disto a consulta passa dos 30 s que o API Gateway tolera. Medido: 31 dias
   levam 3 s; o histórico inteiro, 32 s. A página avisada usa os agregados do arquivo,
   que são idênticos — melhor isso do que um 504 sem explicação. */
const MAX_DIAS = 120;

function janela(req) {
  const de = String(req.query.de || "");
  const ate = String(req.query.ate || "");
  if (!ISO.test(de) || !ISO.test(ate)) return null;
  const dias = (Date.parse(ate) - Date.parse(de)) / 86400000;
  return { de, ate, dias };
}

/** Monta o SELECT interno já com os minutos calculados e os filtros aplicados. */
function base(req, colunas = []) {
  const cond = [];
  const par = [];
  const add = (sql, valor) => { par.push(valor); cond.push(sql.replace("?", `$${par.length}`)); };

  const de = String(req.query.de || "");
  const ate = String(req.query.ate || "");
  if (ISO.test(de)) add("data_ref >= ?::date", de);
  if (ISO.test(ate)) add("data_ref <= ?::date", ate);
  if (req.query.linha) add("linha = ?", String(req.query.linha));
  if (req.query.sentido) add("direcao = ?", String(req.query.sentido));
  if (req.query.garagem) add("garagem = ?", String(req.query.garagem));
  if (req.query.ponto) add("ponto_de_controle = ?", String(req.query.ponto));

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  const extras = colunas.length ? colunas.join(", ") + "," : "";
  return { sql: `SELECT ${extras} ${MIN} AS m FROM cr_0108 ${where}`, par };
}

function erro(res, err) {
  console.error("cr0108:", err);
  res.status(500).json({ ok: false, erro: err.message });
}

const grande = (res, j) => {
  res.json({ ok: true, periodoLongo: true, dias: j?.dias ?? null, limite: MAX_DIAS, itens: [] });
  return true;
};

/** true quando o período é grande demais e a resposta já foi enviada. */
function barrar(req, res) {
  const j = janela(req);
  if (!j || j.dias > MAX_DIAS) return grande(res, j);
  return false;
}

/* ------------------------------------------------------------------ meta */
router.get("/meta", requireFirebaseUser, async (_req, res) => {
  try {
    const [cargas, linhas] = await Promise.all([
      query(`SELECT min(data_ref)::text AS "primeiroDia", max(data_ref)::text AS "ultimoDia",
                    coalesce(sum(linhas), 0) AS registros, count(*) AS dias
             FROM cr_0108_cargas`),
      /* Só o último dia: dá a lista de linhas em milissegundos, em vez de varrer tudo. */
      query(`SELECT DISTINCT linha FROM cr_0108
             WHERE data_ref = (SELECT max(data_ref) FROM cr_0108_cargas)
             ORDER BY linha`)
    ]);
    const c = cargas.rows[0] || {};
    res.json({
      ok: true, origem: "dsql",
      primeiroDia: c.primeiroDia, ultimoDia: c.ultimoDia,
      registros: Number(c.registros || 0), dias: Number(c.dias || 0),
      maxDias: MAX_DIAS,
      linhas: Object.fromEntries(linhas.rows.map((r) => [r.linha, ""]))
    });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ evolução por dia */
router.get("/serie", requireFirebaseUser, async (req, res) => {
  if (barrar(req, res)) return;
  try {
    const b = base(req, ["data_ref"]);
    const r = await query(
      `SELECT data_ref::text AS data, ${AGG} FROM (${b.sql}) t GROUP BY data_ref ORDER BY data_ref`,
      b.par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ ranking */
const DIMENSOES = {
  linha:    "linha",
  ponto:    "ponto_de_controle",
  operador: "operador",
  veiculo:  "veiculo",
  garagem:  "garagem",
  bloco:    "bloco"
};

router.get("/ranking", requireFirebaseUser, async (req, res) => {
  const col = DIMENSOES[String(req.query.dim || "linha")];
  if (!col) { res.status(400).json({ ok: false, erro: "dim inválida" }); return; }
  if (barrar(req, res)) return;
  try {
    const b = base(req, [col]);
    const limite = Math.min(Number(req.query.limite) || 500, 2000);
    const r = await query(
      `SELECT ${col} AS chave, ${AGG} FROM (${b.sql}) t
       GROUP BY ${col} ORDER BY total DESC LIMIT ${limite}`,
      b.par
    );
    res.json({ ok: true, origem: "dsql", dimensao: col, itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ faixa horária */
router.get("/hora", requireFirebaseUser, async (req, res) => {
  if (barrar(req, res)) return;
  try {
    const b = base(req, ["left(programado, 2) AS hora"]);
    const r = await query(
      `SELECT hora, ${AGG} FROM (${b.sql}) t GROUP BY hora ORDER BY hora`, b.par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ cascata: pontos da linha */
router.get("/pontos", requireFirebaseUser, async (req, res) => {
  if (!req.query.linha) { res.status(400).json({ ok: false, erro: "informe a linha" }); return; }
  if (barrar(req, res)) return;
  try {
    const b = base(req, ["ponto_de_controle", "direcao"]);
    const r = await query(
      `SELECT ponto_de_controle AS ponto, direcao AS sentido, ${AGG} FROM (${b.sql}) t
       GROUP BY ponto_de_controle, direcao
       ORDER BY (count(*) - count(*) FILTER (WHERE m BETWEEN -2 AND 6)) DESC`,
      b.par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ cascata: horários do ponto
   Devolve o histograma de desvios; a busca do melhor deslocamento (-20..+20) continua
   no navegador, onde custa milissegundos. */
router.get("/horarios", requireFirebaseUser, async (req, res) => {
  if (!req.query.linha || !req.query.ponto) {
    res.status(400).json({ ok: false, erro: "informe linha e ponto" }); return;
  }
  if (barrar(req, res)) return;
  try {
    const b = base(req, ["programado", "direcao"]);
    const r = await query(
      `SELECT programado, direcao AS sentido, ${AGG},
              array_agg(m) FILTER (WHERE m IS NOT NULL) AS desvios
       FROM (${b.sql}) t GROUP BY programado, direcao ORDER BY programado`,
      b.par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ ICV e IPV
   Vivem sob /cr0108 de propósito: o API Gateway já tem ANY /cr0108/{proxy+}, então
   estas rotas funcionam sem tocar no template. Rota nova em caminho novo exigiria
   declarar o par no CloudFormation — foi o que nos custou um 404 antes. */

/* Os valores vêm como "98.35%" — com o sinal de porcentagem e ponto decimal. Um
   cast direto estoura. Tira-se tudo que não é dígito, ponto ou menos; célula
   vazia vira NULL em vez de erro. */
const numero = (col) =>
  `nullif(regexp_replace(coalesce(${col}, ''), '[^0-9.-]', '', 'g'), '')::numeric`;

router.get("/icv", requireFirebaseUser, async (req, res) => {
  try {
    const cond = [];
    const par = [];
    for (const [campo, sql] of [["de", "data_ref >= ?::date"], ["ate", "data_ref <= ?::date"]]) {
      const v = String(req.query[campo] || "");
      if (ISO.test(v)) { par.push(v); cond.push(sql.replace("?", `$${par.length}`)); }
    }
    const r = await query(
      `SELECT data_ref::text AS data,
              ${numero("icv")}              AS icv,
              ${numero("icv_actual")}       AS "icvReal",
              ${numero("ipv")}              AS ipv,
              ${numero("ipv_trip")}         AS "ipvViagem",
              ${numero("scheduled_trips")}  AS "viagensProgramadas",
              ${numero("trips")}            AS viagens,
              ${numero("late_trips")}       AS atrasadas,
              ${numero("early_trips")}      AS adiantadas,
              ${numero("suppressed_trips")} AS suprimidas
       FROM cr_custom ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
       ORDER BY data_ref`,
      par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

router.get("/ipv", requireFirebaseUser, async (req, res) => {
  try {
    const cond = [];
    const par = [];
    for (const [campo, sql] of [["de", "data_ref >= ?::date"], ["ate", "data_ref <= ?::date"]]) {
      const v = String(req.query[campo] || "");
      if (ISO.test(v)) { par.push(v); cond.push(sql.replace("?", `$${par.length}`)); }
    }
    const r = await query(
      `SELECT data_ref::text AS data,
              ${numero("ipv_actual")} AS ipv,
              ${numero("adiantado")}  AS adiantado,
              ${numero("atrasado")}   AS atrasado,
              ${numero("pontos_de_controle_processados")} AS "pontosProcessados"
       FROM cr_custom_ontime ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
       ORDER BY data_ref`,
      par
    );
    res.json({ ok: true, origem: "dsql", itens: r.rows });
  } catch (err) { erro(res, err); }
});

export default router;
