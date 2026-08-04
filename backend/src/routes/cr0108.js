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

/* Uma varredura do histórico inteiro leva ~32 s e o API Gateway corta em 30. Mas o
   trabalho é divisível: faixas de datas são disjuntas, então quatro consultas menores
   em paralelo terminam em ~8 s e depois somamos os contadores aqui. Medido: 31 dias
   levam 3 s. Acima deste tamanho, divide. */
const FAIXA_DIAS = 45;

const dia = (iso) => new Date(iso + "T00:00:00Z");
const iso = (d) => d.toISOString().slice(0, 10);

/** Quebra [de, ate] em pedaços de no máximo FAIXA_DIAS. Um só pedaço = período curto. */
function faixas(req) {
  const de = String(req.query.de || "");
  const ate = String(req.query.ate || "");
  if (!ISO.test(de) || !ISO.test(ate)) return [{}];           // sem recorte: uma consulta só
  const fim = dia(ate);
  const pedacos = [];
  let ini = dia(de);
  while (ini <= fim) {
    const prox = new Date(ini.getTime() + (FAIXA_DIAS - 1) * 86400000);
    const ate2 = prox > fim ? fim : prox;
    pedacos.push({ de: iso(ini), ate: iso(ate2) });
    ini = new Date(ate2.getTime() + 86400000);
  }
  return pedacos;
}

const SOMAVEIS = ["total", "noHorario", "adiantado", "atrasado", "divergente", "somaDif", "semDif"];

/** Soma as linhas das faixas, agrupando pelas colunas-chave. */
function juntar(listas, chaves) {
  const mapa = new Map();
  for (const linhas of listas) {
    for (const l of linhas) {
      const k = chaves.map((c) => l[c]).join("\u0001");
      const atual = mapa.get(k);
      if (!atual) { mapa.set(k, { ...l }); continue; }
      for (const c of SOMAVEIS) {
        if (l[c] !== undefined) atual[c] = Number(atual[c] || 0) + Number(l[c] || 0);
      }
      if (Array.isArray(l.desvios)) {
        atual.desvios = (atual.desvios || []).concat(l.desvios);
      }
    }
  }
  return [...mapa.values()];
}

/**
 * Roda a consulta uma vez por faixa, em paralelo, e junta.
 * `montar(sqlInterno)` devolve o SQL externo; `chaves` diz por onde agrupar ao somar.
 */
async function consultar(req, colunas, montar, chaves) {
  const pedacos = faixas(req);
  const resultados = await Promise.all(pedacos.map((f) => {
    const reqFaixa = { query: { ...req.query, ...(f.de ? { de: f.de, ate: f.ate } : {}) } };
    const b = base(reqFaixa, colunas);
    return query(montar(b.sql), b.par).then((r) => r.rows);
  }));
  return pedacos.length === 1 ? resultados[0] : juntar(resultados, chaves);
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
      linhas: Object.fromEntries(linhas.rows.map((r) => [r.linha, ""]))
    });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ evolução por dia */
router.get("/serie", requireFirebaseUser, async (req, res) => {
  try {
    const itens = await consultar(req, ["data_ref"],
      (sql) => `SELECT data_ref::text AS data, ${AGG} FROM (${sql}) t GROUP BY data_ref ORDER BY data_ref`,
      ["data"]);
    itens.sort((a, b2) => a.data.localeCompare(b2.data));
    res.json({ ok: true, origem: "dsql", itens });
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
  try {
    const limite = Math.min(Number(req.query.limite) || 500, 2000);
    /* O LIMIT vale por faixa; depois de somar, reordenamos e cortamos de novo — senão
       um item que aparece pouco em cada mês some, mesmo sendo grande no total. */
    const itens = await consultar(req, [col],
      (sql) => `SELECT ${col} AS chave, ${AGG} FROM (${sql}) t GROUP BY ${col}`,
      ["chave"]);
    itens.sort((a, b2) => Number(b2.total) - Number(a.total));
    res.json({ ok: true, origem: "dsql", dimensao: col, itens: itens.slice(0, limite) });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ faixa horária */
router.get("/hora", requireFirebaseUser, async (req, res) => {
  /* O programado vem com espaço à esquerda (" 5:55") e às vezes com hora de um
     dígito. left(...,2) pegava " 0" / " 1" / " 2": agrupava pelo primeiro dígito da
     hora e devolvia 3 faixas em vez de 24. btrim + split_part corrige os dois casos. */
  const HORA = "lpad(split_part(btrim(programado), ':', 1), 2, '0')";
  try {
    const itens = await consultar(req, [`${HORA} AS hora`],
      (sql) => `SELECT hora, ${AGG} FROM (${sql}) t GROUP BY hora`, ["hora"]);
    itens.sort((a, b2) => String(a.hora).localeCompare(String(b2.hora)));
    res.json({ ok: true, origem: "dsql", itens });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ cascata: pontos da linha */
router.get("/pontos", requireFirebaseUser, async (req, res) => {
  if (!req.query.linha) { res.status(400).json({ ok: false, erro: "informe a linha" }); return; }
  try {
    const itens = await consultar(req, ["ponto_de_controle", "direcao"],
      (sql) => `SELECT ponto_de_controle AS ponto, direcao AS sentido, ${AGG} FROM (${sql}) t
                GROUP BY ponto_de_controle, direcao`,
      ["ponto", "sentido"]);
    /* Ordena por impacto: passagens fora do horário, não percentual. */
    itens.sort((a, b2) => (Number(b2.total) - Number(b2.noHorario)) - (Number(a.total) - Number(a.noHorario)));
    res.json({ ok: true, origem: "dsql", itens });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ cascata: horários do ponto
   Devolve o histograma de desvios; a busca do melhor deslocamento (-20..+20) continua
   no navegador, onde custa milissegundos. */
router.get("/horarios", requireFirebaseUser, async (req, res) => {
  if (!req.query.linha || !req.query.ponto) {
    res.status(400).json({ ok: false, erro: "informe linha e ponto" }); return;
  }
  try {
    const itens = await consultar(req, ["btrim(programado) AS programado", "direcao"],
      (sql) => `SELECT programado, direcao AS sentido, ${AGG},
                       array_agg(m) FILTER (WHERE m IS NOT NULL) AS desvios
                FROM (${sql}) t GROUP BY programado, direcao`,
      ["programado", "sentido"]);
    itens.sort((a, b2) => String(a.programado).localeCompare(String(b2.programado)));
    res.json({ ok: true, origem: "dsql", itens });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ operador
   A coluna `operador` guarda tudo numa string só, no formato
       "GONCALVES, JOSE, 11976       "
   ou seja: nome primeiro, matrícula por ÚLTIMO, com espaços à direita. E os nomes
   têm vírgula dentro deles. Separar pela PRIMEIRA vírgula devolveria "GONCALVES"
   como matrícula e produziria um ranking inteiro errado, com números plausíveis.
   Por isso os regex ancoram na última vírgula.

   O agrupamento é por `operador` inteiro (e não pelas partes), o que mantém o GROUP BY
   estável mesmo se algum registro vier com espaçamento diferente. */
const MATRICULA = `btrim(regexp_replace(operador, '^.*,\\s*([^,]*)$', '\\1'))`;
const NOME      = `btrim(regexp_replace(operador, '^(.*),[^,]*$', '\\1'))`;
const MES       = `to_char(data_ref, 'YYYY-MM')`;

router.get("/operador", requireFirebaseUser, async (req, res) => {
  try {
    const itens = await consultar(req, [`${MES} AS mes`, "operador"],
      (sql) => `SELECT mes, ${MATRICULA} AS matricula, ${NOME} AS nome, ${AGG}
                FROM (${sql}) t GROUP BY mes, operador`,
      ["mes", "matricula"]);
    itens.sort((a, b) => a.mes.localeCompare(b.mes) || String(a.matricula).localeCompare(String(b.matricula)));
    res.json({ ok: true, origem: "dsql", itens });
  } catch (err) { erro(res, err); }
});

/* Mesmo agregado cruzado com a linha. A página consome com chaves curtas
   (m, k, l, n, a, t, d, T, S) para o arquivo não ficar gigante — são ~34 mil linhas.
   O SQL devolve os nomes longos de propósito: é o que a soma entre faixas conhece.
   A troca para as chaves curtas acontece depois de somar. */
router.get("/operador-linha", requireFirebaseUser, async (req, res) => {
  try {
    const itens = await consultar(req, [`${MES} AS mes`, "operador", "linha"],
      (sql) => `SELECT mes, ${MATRICULA} AS matricula, linha, ${AGG}
                FROM (${sql}) t GROUP BY mes, operador, linha`,
      ["mes", "matricula", "linha"]);
    const curto = itens.map((x) => ({
      m: x.mes, k: x.matricula, l: x.linha,
      n: Number(x.noHorario), a: Number(x.adiantado), t: Number(x.atrasado),
      d: Number(x.divergente), T: Number(x.total), S: Number(x.somaDif)
    }));
    curto.sort((x, y) => x.m.localeCompare(y.m) || String(x.k).localeCompare(String(y.k)));
    res.json({ ok: true, origem: "dsql", itens: curto });
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

/* Duas medições distintas de pontualidade, cada uma na sua tabela:
     2/6 (padrão)     cr_custom_ontime — 213 dias, IPV na casa dos 92%
     1/3 (alternativo) cr_0258         — 44 dias (01/06 a 15/07), IPV na casa dos 80%
   Elas NÃO se somam nem se misturam: medem coisas diferentes e uma média entre as
   duas produziria um número sem significado. O parâmetro fonte escolhe qual ler, e a
   resposta usa os mesmos nomes de campo nos dois casos para a página não traduzir.
   Em cr_0258 o total de pontos vem com vírgula de milhar ("13,308"): o numero() tira
   tudo que não é dígito, ponto ou menos, então vira 13308 — conferido. */
const FONTES_IPV = {
  "2-6": { tabela: "cr_custom_ontime",
           ipv: "ipv_actual", adiantado: "adiantado", atrasado: "atrasado",
           pontos: "pontos_de_controle_processados" },
  "1-3": { tabela: "cr_0258",
           ipv: "on_time", adiantado: "early", atrasado: "late",
           pontos: "timepoints_processed" }
};

router.get("/ipv", requireFirebaseUser, async (req, res) => {
  const chave = String(req.query.fonte || "2-6");
  const f = FONTES_IPV[chave];
  if (!f) {
    res.status(400).json({ ok: false, erro: "fonte inválida (use 2-6 ou 1-3)" });
    return;
  }
  try {
    const cond = [];
    const par = [];
    for (const [campo, sql] of [["de", "data_ref >= ?::date"], ["ate", "data_ref <= ?::date"]]) {
      const v = String(req.query[campo] || "");
      if (ISO.test(v)) { par.push(v); cond.push(sql.replace("?", `$${par.length}`)); }
    }
    const r = await query(
      `SELECT data_ref::text AS data,
              ${numero(f.ipv)}       AS ipv,
              ${numero(f.adiantado)} AS adiantado,
              ${numero(f.atrasado)}  AS atrasado,
              ${numero(f.pontos)}    AS "pontosProcessados"
       FROM ${f.tabela} ${cond.length ? `WHERE ${cond.join(" AND ")}` : ""}
       ORDER BY data_ref`,
      par
    );
    res.json({ ok: true, origem: "dsql", fonte: chave, itens: r.rows });
  } catch (err) { erro(res, err); }
});

export default router;
