import { Router } from "express";
import { query } from "../db.js";
import { DATA_ISO as ISO } from "../lib/validar.js";
import { intervaloDatas } from "../lib/validar.js";
import { asyncHandler } from "../lib/http.js";
import { ipvAjustadoDia, ipvAjustadoPeriodo, chaveLinha, numeroCampo, pontosOficiaisDaLinha, pontosRecuperadosDoIncidente, agregarExtras } from "../lib/ipv-ajustado.js";
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

/** 0=domingo … 6=sábado (calendário da data_ref, sem fuso). */
function condTipoDia(req) {
  const t = String(req.query.tipoDia || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t === "uteis") return "EXTRACT(DOW FROM data_ref) BETWEEN 1 AND 5";
  if (t === "sabado") return "EXTRACT(DOW FROM data_ref) = 6";
  if (t === "domingo") return "EXTRACT(DOW FROM data_ref) = 0";
  return "";
}

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

const SOMAVEIS = ["total", "noHorario", "adiantado", "atrasado", "divergente", "somaDif", "semDif", "n"];

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
  const tipoDia = condTipoDia(req);
  if (tipoDia) cond.push(tipoDia);

  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  const extras = colunas.length ? colunas.join(", ") + "," : "";
  return { sql: `SELECT ${extras} ${MIN} AS m FROM cr_0108 ${where}`, par };
}

/* ================================================================== agregados diarios

   O gargalo do relatorio era a varredura: qualquer corte do historico inteiro relia as
   2,36 milhoes de passagens e reconvertia `diferenca` linha a linha, ~32 s no limite do
   API Gateway. As tabelas cr0108_dia_linha e cr0108_dia_hora guardam os mesmos cinco
   baldes do CIOP ja contados por dia, 34.574 e 5.130 linhas. A mesma pergunta que
   levava dezenas de segundos responde em ~300 ms, sem paralelizar faixas.

   Conferidas contra a passagem crua: ate 30/07 devolvem 2.335.186 registros,
   2.138.906 no horario, 112.633 adiantado, 77.155 atrasado, 6.492 divergente,
   semDif 0 e desvio medio 0,94, os mesmos seis numeros publicados.

   LIMITE: os agregados so conhecem data, linha, sentido e hora programada. Filtro por
   garagem ou por ponto de controle precisa da passagem crua, entao nesses casos as rotas
   caem no caminho antigo. E de proposito: o caso lento e o historico sem recorte fino,
   e ele passa pelo atalho.

   MANUTENCAO: a carga da cr_0108 roda fora deste repositorio, e o DSQL nao tem trigger
   nem materialized view. Depois de cada carga e preciso rodar o refresh do dia em
   agregados-cr0108.sql. Se o agregado ficar para tras, /meta continua vindo de
   cr_0108_cargas e vai mostrar um ultimo dia mais recente do que os graficos: e o
   sintoma a procurar. */

const AGG_PRE = `
  sum(total)        AS total,
  sum(no_horario)   AS "noHorario",
  sum(adiantado)    AS adiantado,
  sum(atrasado)     AS atrasado,
  sum(divergente)   AS divergente,
  sum(soma_dif)     AS "somaDif",
  sum(sem_dif)      AS "semDif"`;

/** Garagem e ponto nao existem nos agregados. */
const temRecorteFino = (req) => Boolean(req.query.garagem || req.query.ponto);

/** cr0108_dia_hora tambem nao tem linha nem sentido. */
const temRecortePorLinha = (req) => Boolean(req.query.linha || req.query.sentido);

/** WHERE sobre um agregado. `comLinha` libera os filtros de linha e sentido. */
function filtroAgregado(req, comLinha) {
  const cond = [];
  const par = [];
  const add = (sql, valor) => { par.push(valor); cond.push(sql.replace("?", `$${par.length}`)); };

  const de = String(req.query.de || "");
  const ate = String(req.query.ate || "");
  if (ISO.test(de)) add("data_ref >= ?::date", de);
  if (ISO.test(ate)) add("data_ref <= ?::date", ate);
  if (comLinha && req.query.linha) add("linha = ?", String(req.query.linha));
  if (comLinha && req.query.sentido) add("direcao = ?", String(req.query.sentido));
  const tipoDia = condTipoDia(req);
  if (tipoDia) cond.push(tipoDia);

  return { where: cond.length ? `WHERE ${cond.join(" AND ")}` : "", par };
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
    let itens;
    let origem = "agregado";
    if (temRecorteFino(req)) {
      origem = "dsql";
      itens = await consultar(req, ["data_ref"],
        (sql) => `SELECT data_ref::text AS data, ${AGG} FROM (${sql}) t GROUP BY data_ref ORDER BY data_ref`,
        ["data"]);
    } else {
      const f = filtroAgregado(req, true);
      const r = await query(
        `SELECT data_ref::text AS data, ${AGG_PRE}
         FROM cr0108_dia_linha ${f.where}
         GROUP BY data_ref ORDER BY data_ref`, f.par);
      itens = r.rows;
    }
    itens.sort((a, b2) => a.data.localeCompare(b2.data));
    res.json({ ok: true, origem, itens });
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
  const dim = String(req.query.dim || "linha");
  const col = DIMENSOES[dim];
  if (!col) { res.status(400).json({ ok: false, erro: "dim invalida" }); return; }
  try {
    const limite = Math.min(Number(req.query.limite) || 500, 2000);
    let itens;
    let origem = "agregado";
    /* So a dimensao linha existe no agregado. As outras continuam na passagem crua. */
    if (dim !== "linha" || temRecorteFino(req)) {
      origem = "dsql";
      /* O LIMIT vale por faixa; depois de somar, reordenamos e cortamos de novo, senao
         um item que aparece pouco em cada mes some, mesmo sendo grande no total. */
      itens = await consultar(req, [col],
        (sql) => `SELECT ${col} AS chave, ${AGG} FROM (${sql}) t GROUP BY ${col}`,
        ["chave"]);
    } else {
      const f = filtroAgregado(req, true);
      const r = await query(
        `SELECT linha AS chave, ${AGG_PRE}
         FROM cr0108_dia_linha ${f.where} GROUP BY linha`, f.par);
      itens = r.rows;
    }
    itens.sort((a, b2) => Number(b2.total) - Number(a.total));
    res.json({ ok: true, origem, dimensao: col, itens: itens.slice(0, limite) });
  } catch (err) { erro(res, err); }
});

/* ------------------------------------------------------------------ faixa horária */
router.get("/hora", requireFirebaseUser, async (req, res) => {
  /* O programado vem com espaco a esquerda (" 5:55") e as vezes com hora de um
     digito. left(...,2) pegava " 0" / " 1" / " 2": agrupava pelo primeiro digito da
     hora e devolvia 3 faixas em vez de 24. btrim + split_part corrige os dois casos.
     O agregado cr0108_dia_hora ja guarda a hora normalizada assim, com dois digitos. */
  const HORA = "lpad(split_part(btrim(programado), ':', 1), 2, '0')";
  try {
    let itens;
    let origem = "agregado";
    /* cr0108_dia_hora nao tem linha nem sentido, alem de nao ter garagem e ponto. */
    if (temRecorteFino(req) || temRecortePorLinha(req)) {
      origem = "dsql";
      itens = await consultar(req, [`${HORA} AS hora`],
        (sql) => `SELECT hora, ${AGG} FROM (${sql}) t GROUP BY hora`, ["hora"]);
    } else {
      const f = filtroAgregado(req, false);
      const r = await query(
        `SELECT hora, ${AGG_PRE} FROM cr0108_dia_hora ${f.where} GROUP BY hora`, f.par);
      itens = r.rows;
    }
    itens.sort((a, b2) => String(a.hora).localeCompare(String(b2.hora)));
    res.json({ ok: true, origem, itens });
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
    const tipoDia = condTipoDia(req);
    if (tipoDia) cond.push(tipoDia);
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
    const tipoDia = condTipoDia(req);
    if (tipoDia) cond.push(tipoDia);
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

async function catalogoPontosPorLinha(de, ate) {
  const ateD = new Date(`${ate}T00:00:00Z`);
  const deD = new Date(`${de}T00:00:00Z`);
  const deCat = (ateD - deD) / 86400000 > 14
    ? new Date(ateD.getTime() - 13 * 86400000).toISOString().slice(0, 10)
    : de;
  return query(
    `SELECT btrim(linha) AS linha, btrim(ponto_de_controle) AS ponto
     FROM cr_0108
     WHERE data_ref >= $1::date AND data_ref <= $2::date
       AND btrim(coalesce(linha, '')) <> ''
       AND btrim(coalesce(ponto_de_controle, '')) <> ''
     GROUP BY 1, 2`,
    [deCat < de ? de : deCat, ate]
  );
}

async function passagensDosIncidentes(de, ate) {
  return query(
    `SELECT c.id::text AS id,
            c.data_ref::date::text AS dia,
            btrim(c.linha) AS linha,
            c.instrucao,
            c.natureza_do_ploblema AS natureza,
            c.duracao_de_abertura_total_hh_mm AS duracao,
            btrim(p.ponto_de_controle) AS ponto,
            btrim(p.programado) AS programado,
            btrim(p.hora_realizada) AS realizado,
            ${MIN} AS desvio
     FROM cr_0002 c
     LEFT JOIN cr_0108 p
       ON p.data_ref = c.data_ref
      AND btrim(coalesce(c.veiculo, '')) <> ''
      AND btrim(p.veiculo) = btrim(c.veiculo)
      AND regexp_replace(btrim(p.linha), '[^0-9]', '', 'g')
          = regexp_replace(btrim(c.linha), '[^0-9]', '', 'g')
      AND (btrim(coalesce(c.direcao, '')) = ''
           OR btrim(p.direcao) = btrim(c.direcao))
     WHERE c.data_ref >= $1::date AND c.data_ref <= $2::date`,
    [de, ate]
  );
}

function montarCatalogoOficial(rows) {
  const nomes = new Map();
  for (const r of rows || []) {
    const k = chaveLinha(r.linha);
    if (!k) continue;
    const arr = nomes.get(k) || [];
    arr.push(r.ponto);
    nomes.set(k, arr);
  }
  const catalogo = new Map();
  for (const [k, lista] of nomes) {
    const oficiais = pontosOficiaisDaLinha(lista);
    catalogo.set(k, { pontos: oficiais.length, nomes: oficiais });
  }
  return catalogo;
}

function incidentesLigados(rows) {
  const porId = new Map();
  for (const r of rows || []) {
    const id = String(r.id || "");
    if (!id) continue;
    const cur = porId.get(id) || {
      id,
      data: isoCad(r.dia),
      linha: chaveLinha(r.linha),
      instrucao: r.instrucao,
      natureza: r.natureza,
      duracao: r.duracao,
      passagens: []
    };
    if (r.ponto) {
      cur.passagens.push({
        ponto: r.ponto,
        programado: r.programado,
        realizado: r.realizado,
        desvio: r.desvio == null ? null : Number(r.desvio)
      });
    }
    porId.set(id, cur);
  }
  return [...porId.values()].map((inc) => {
    const rec = pontosRecuperadosDoIncidente(inc.passagens, inc);
    return {
      data: inc.data,
      linha: inc.linha,
      extra: rec.extra,
      pontos: rec.pontos,
      motivos: rec.motivos
    };
  });
}

/** IPV Custom ponderado por pontos. Recupera só ponto com conexão de horário/veículo/linha. */
router.get("/ipv-ajustado", requireFirebaseUser, asyncHandler(async (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const { de, ate } = intervaloDatas(req.query.de || hoje, req.query.ate || req.query.de || hoje);
  const ontime = await query(
    `SELECT data_ref::text AS data,
            ${numero("ipv_actual")} AS ipv,
            ${numero("pontos_de_controle_processados")} AS pontos
     FROM cr_custom_ontime
     WHERE data_ref >= $1::date AND data_ref <= $2::date
     ORDER BY data_ref`,
    [de, ate]
  );

  let avisoJoin = null;
  let ligados = [];
  let catalogo = new Map();
  try {
    const [pass, cat] = await Promise.all([
      passagensDosIncidentes(de, ate),
      catalogoPontosPorLinha(de, ate).catch(() => ({ rows: [] }))
    ]);
    ligados = incidentesLigados(pass.rows);
    catalogo = montarCatalogoOficial(cat.rows);
  } catch (err) {
    avisoJoin = "Não foi possível cruzar 002 × CR-0108 neste recorte";
    console.warn("ipv-ajustado join:", err?.message || err);
  }

  const tot = agregarExtras(ligados);
  const dias = ontime.rows.map((r) => {
    const data = String(r.data).slice(0, 10);
    const extraDia = tot.extraPorDia.get(data) || { extra: 0, incidentes: 0, semConexao: 0 };
    const base = {
      data,
      ipv: numeroCampo(r.ipv),
      pontos: numeroCampo(r.pontos),
      extraPontos: extraDia.extra,
      incidentes: extraDia.incidentes
    };
    return { ...base, ...ipvAjustadoDia(base), semConexao: extraDia.semConexao };
  });

  for (const [data, extraDia] of tot.extraPorDia) {
    if (dias.some((d) => d.data === data)) continue;
    const base = { data, ipv: 0, pontos: 0, extraPontos: extraDia.extra, incidentes: extraDia.incidentes };
    dias.push({ ...base, ...ipvAjustadoDia(base), customPendente: true, semConexao: extraDia.semConexao });
  }
  dias.sort((a, b) => a.data.localeCompare(b.data));

  const periodo = ipvAjustadoPeriodo(dias.filter((d) => !d.customPendente));
  const linhas = tot.porLinha.map((l) => {
    const catL = catalogo.get(l.linha);
    return {
      ...l,
      pontosControle: catL?.pontos || l.pontos.length,
      nomes: catL?.nomes || l.pontos
    };
  });
  const aviso = [
    avisoJoin,
    tot.semConexao ? `${tot.semConexao} incidente(s) sem ponto ligado no horário` : null
  ].filter(Boolean).join(" · ") || null;

  res.json({
    ok: true,
    origem: "dsql",
    regra: "Recupera o ponto só se o incidente (veículo, linha, sentido e horário) ligar à passagem do CR-0108. Na 407 os pontos oficiais são Terminal Central, Terminal Milton Gavetti e Bairro.",
    exemplo: "407: Central, Milton Gavetti e bairro (3). 904: Acapulco, Catuai, Oeste e Vivi Xavier (4).",
    de,
    ate,
    ipv: periodo.ipv,
    ipvAjustado: periodo.ipvAjustado,
    ganhoPp: periodo.ganhoPp,
    incidentes: tot.incidentes,
    extraPontos: tot.extra,
    semConexao: tot.semConexao,
    volume: periodo.volume,
    linhasCatalogo: catalogo.size,
    aviso,
    linhas,
    dias
  });
}));

/* Histograma compacto para o diagnóstico de ajustes: um bin por
   (linha, sentido, ponto, programado, desvio). Só para janelas de até 90 dias —
   o histórico inteiro estoura o gateway. A página pinta o JSON e só pede isto
   quando o recorte cabe. */
router.get("/histograma", requireFirebaseUser, async (req, res) => {
  const de = String(req.query.de || "");
  const ate = String(req.query.ate || "");
  if (!ISO.test(de) || !ISO.test(ate)) {
    res.json({ ok: true, periodoLongo: true, itens: [] });
    return;
  }
  const nDias = (dia(ate) - dia(de)) / 86400000 + 1;
  if (nDias > 90) {
    res.json({ ok: true, periodoLongo: true, itens: [] });
    return;
  }
  try {
    const itens = await consultar(
      req,
      ["linha", "direcao", "ponto_de_controle", "btrim(programado) AS programado"],
      (sql) => `SELECT linha, direcao AS sentido, ponto_de_controle AS ponto, programado,
                       m::int AS desvio, count(*)::int AS n
                FROM (${sql}) t
                WHERE m BETWEEN -90 AND 90
                GROUP BY linha, direcao, ponto_de_controle, programado, m`,
      ["linha", "sentido", "ponto", "programado", "desvio"]
    );
    res.json({ ok: true, origem: "dsql", itens });
  } catch (err) { erro(res, err); }
});

function cadValor(v, profundidade = 0) {
  if (v == null) return v;
  if (typeof v === "bigint") return Number(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v.length > 4000 ? `${v.slice(0, 4000)}…` : v;
  if (Buffer.isBuffer(v)) return undefined;
  if (Array.isArray(v)) {
    if (profundidade > 2) return v.slice(0, 20).map(String);
    return v.slice(0, 80).map((x) => cadValor(x, profundidade + 1));
  }
  if (typeof v === "object") {
    if (profundidade > 3) return undefined;
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

function cadLinha(row) {
  if (!row || typeof row !== "object") return row;
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

function citarColuna(nome) {
  const n = String(nome || "");
  if (/^[a-z_][a-z0-9_]*$/i.test(n)) return n;
  return `"${n.replace(/"/g, "")}"`;
}

function isoCad(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return "";
}

function dataDaLinhaCad(row, dataCol) {
  const keys = [dataCol, "data_ref", "data", "dt", "date", "dt_incidente", "data_hora", "inicio"].filter(Boolean);
  for (const k of keys) {
    if (row?.[k] != null) {
      const iso = isoCad(row[k]);
      if (iso) return iso;
    }
    const found = Object.keys(row || {}).find((x) => x.toLowerCase() === String(k).toLowerCase());
    if (found) {
      const iso = isoCad(row[found]);
      if (iso) return iso;
    }
  }
  return "";
}

/* Relatório Clever 002 — cr_0002 em páginas (OFFSET). Sem teto de 5000.
   O cliente junta as páginas até count(*). */
router.get("/cad", requireFirebaseUser, async (req, res) => {
  try {
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const limite = Math.min(Math.max(Number(req.query.limite) || 800, 50), 2000);
    const offset = (pagina - 1) * limite;

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
    } catch (_) { /* SELECT * */ }

    const dataCol = colunas.find((n) => /^(data_ref|data|dt|date)$/i.test(n))
      || colunas.find((n) => /data|date|dia/i.test(n));
    const idCol = colunas.find((n) => /^(id|id_incidente|pk)$/i.test(n));
    const lista = colunas.length ? colunas.map(citarColuna).join(", ") : "*";
    const ordem = idCol
      ? ` ORDER BY ${citarColuna(idCol)}`
      : (dataCol ? ` ORDER BY ${citarColuna(dataCol)} DESC` : " ORDER BY 1");

    let totalTabela = 0;
    try {
      const c = await query(`SELECT count(*)::int AS n FROM cr_0002`);
      totalTabela = Number(c.rows?.[0]?.n || 0);
    } catch (_) { /* segue no SELECT */ }

    let r;
    try {
      r = await query(`SELECT ${lista} FROM cr_0002${ordem} LIMIT ${limite} OFFSET ${offset}`);
    } catch (_) {
      r = await query(`SELECT ${lista} FROM cr_0002 LIMIT ${limite} OFFSET ${offset}`);
    }
    const itens = (r.rows || []).map(cadLinha);
    if (!colunas.length && itens[0]) colunas = Object.keys(itens[0]);
    if (!totalTabela) totalTabela = offset + itens.length + (itens.length === limite ? 1 : 0);

    let cargas = {};
    try {
      const c = await query(
        `SELECT min(data_ref)::text AS "primeiroDia",
                max(data_ref)::text AS "ultimoDia",
                count(*)::int AS dias,
                coalesce(sum(linhas), 0) AS registros
         FROM cr_0002_cargas`
      );
      cargas = c.rows[0] || {};
    } catch (_) { /* cargas pode ter outro desenho */ }

    res.json({
      ok: true,
      origem: "dsql",
      tabela: "cr_0002",
      colunas,
      meta: {
        total: totalTabela,
        totalTabela,
        pagina,
        limite,
        recorte: itens.length,
        temMais: offset + itens.length < totalTabela,
        janela: "tabela",
        ...cargas
      },
      itens
    });
  } catch (err) { erro(res, err); }
});

async function primeiraTabela(nomes) {
  for (const nome of nomes) {
    try {
      await query(`SELECT 1 FROM ${nome} LIMIT 1`);
      return nome;
    } catch (_) { /* próximo nome */ }
  }
  return null;
}

function campo(row, chaves) {
  for (const k of chaves) {
    if (row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

/* Relatório Clever 001 — ranking de motoristas. Não usa cr_0108 nem o 002. */
router.get("/ranking-001", requireFirebaseUser, async (req, res) => {
  try {
    const tabela = await primeiraTabela(["cr_001", "cr_0001", "cr_001_reports"]);
    if (!tabela) {
      res.json({ ok: true, origem: "dsql", tabela: null, itens: [] });
      return;
    }
    const r = await query(`SELECT * FROM ${tabela} LIMIT 20000`);
    const itens = r.rows.map((row) => {
      const data = String(campo(row, ["mes", "month", "data_ref", "data", "date"]));
      const mes = /^\d{4}-\d{2}/.test(data) ? data.slice(0, 7) : data;
      return {
        mes,
        matricula: String(campo(row, ["matricula", "badge", "operator_id", "id"])),
        nome: String(campo(row, ["nome", "name", "operador", "operator"])),
        noHorario: Number(campo(row, ["noHorario", "no_horario", "on_time"]) || 0),
        adiantado: Number(campo(row, ["adiantado", "early"]) || 0),
        atrasado: Number(campo(row, ["atrasado", "late"]) || 0),
        divergente: Number(campo(row, ["divergente", "divergent"]) || 0),
        total: Number(campo(row, ["total", "trips", "passagens"]) || 0),
        somaDif: Number(campo(row, ["somaDif", "soma_dif", "sum_diff"]) || 0),
        semDif: Number(campo(row, ["semDif", "sem_dif"]) || 0)
      };
    }).filter((x) => x.mes && x.matricula);
    res.json({ ok: true, origem: "dsql", tabela, itens });
  } catch (err) { erro(res, err); }
});

export default router;
