/**
 * Publica os JSONs do CR-0108 a partir do Aurora DSQL (não da pasta de CSV).
 *
 * 1. Completa cr0108_dia_linha / cr0108_dia_hora com os dias que já estão em cr_0108_cargas.
 * 2. Gera meta.json, por-dia*.json e, se der tempo, ranking mensal de motorista.
 *
 *   DSQL_CLUSTER_ID=… AWS_ACCESS_KEY_ID=… node scripts/exportar-cr0108-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, closePool } from "../backend/src/db.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "assets/data/cr0108");
const COM_OPERADOR = process.env.CR0108_JSON_COM_OPERADOR !== "0";

const MIN = `
  CASE WHEN diferenca ~ '^-?[0-9]+:[0-9][0-9]'
  THEN (CASE WHEN left(diferenca, 1) = '-' THEN -1 ELSE 1 END) *
       (split_part(ltrim(diferenca, '-'), ':', 1)::int * 60 +
        split_part(ltrim(diferenca, '-'), ':', 2)::int)
  END`;

const n = (v) => Number(v || 0);

function baldes(row) {
  return {
    noHorario: n(row.noHorario ?? row.no_horario),
    adiantado: n(row.adiantado),
    atrasado: n(row.atrasado),
    divergente: n(row.divergente),
    total: n(row.total),
    somaDif: n(row.somaDif ?? row.soma_dif),
    semDif: n(row.semDif ?? row.sem_dif)
  };
}

function gravar(nome, obj) {
  const p = path.join(DIR, nome);
  fs.writeFileSync(p, JSON.stringify(obj));
  const kb = fs.statSync(p).size / 1024;
  const qtd = Array.isArray(obj) ? obj.length : 1;
  console.log(`  ${nome}: ${qtd} · ${kb.toFixed(0)} KB`);
}

function lerJson(nome, fallback) {
  const p = path.join(DIR, nome);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

async function iso(sql, par = []) {
  const r = await query(sql, par);
  const row = r.rows[0] || {};
  const v = row.max || row.min || row.v || Object.values(row)[0];
  return v == null ? "" : String(v).slice(0, 10);
}

async function refreshAgregados(desde) {
  if (!desde) return;
  console.log(`Refresh agregados desde ${desde}…`);
  await query(`DELETE FROM cr0108_dia_linha WHERE data_ref >= $1::date`, [desde]);
  await query(
    `INSERT INTO cr0108_dia_linha (data_ref, linha, direcao, total, no_horario, adiantado, atrasado, divergente, soma_dif, sem_dif)
     SELECT data_ref, linha, coalesce(nullif(btrim(direcao), ''), '—'),
            count(*),
            count(*) FILTER (WHERE m BETWEEN -2 AND 6),
            count(*) FILTER (WHERE m BETWEEN -10 AND -3),
            count(*) FILTER (WHERE m BETWEEN 7 AND 15),
            count(*) FILTER (WHERE m >= 16 OR m <= -11),
            coalesce(sum(m), 0),
            count(*) FILTER (WHERE m IS NULL)
     FROM (SELECT data_ref, linha, direcao, ${MIN} AS m FROM cr_0108 WHERE data_ref >= $1::date) t
     GROUP BY 1, 2, 3`,
    [desde]
  );
  await query(`DELETE FROM cr0108_dia_hora WHERE data_ref >= $1::date`, [desde]);
  await query(
    `INSERT INTO cr0108_dia_hora (data_ref, hora, total, no_horario, adiantado, atrasado, divergente, soma_dif, sem_dif)
     SELECT data_ref, lpad(split_part(btrim(programado), ':', 1), 2, '0'),
            count(*),
            count(*) FILTER (WHERE m BETWEEN -2 AND 6),
            count(*) FILTER (WHERE m BETWEEN -10 AND -3),
            count(*) FILTER (WHERE m BETWEEN 7 AND 15),
            count(*) FILTER (WHERE m >= 16 OR m <= -11),
            coalesce(sum(m), 0),
            count(*) FILTER (WHERE m IS NULL)
     FROM (SELECT data_ref, programado, ${MIN} AS m FROM cr_0108 WHERE data_ref >= $1::date) t
     GROUP BY 1, 2`,
    [desde]
  );
  console.log("  agregados atualizados");
}

function somarDias(isoDia, delta) {
  const d = new Date(isoDia + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function exportarOperador(primeiro, ultimo) {
  const MAT = `btrim(regexp_replace(operador, '^.*,\\s*([^,]*)$', '\\1'))`;
  const NOME = `btrim(regexp_replace(operador, '^(.*),[^,]*$', '\\1'))`;
  const AGG = `
    count(*) AS total,
    count(*) FILTER (WHERE m BETWEEN -2 AND 6) AS "noHorario",
    count(*) FILTER (WHERE m BETWEEN -10 AND -3) AS adiantado,
    count(*) FILTER (WHERE m BETWEEN 7 AND 15) AS atrasado,
    count(*) FILTER (WHERE m >= 16 OR m <= -11) AS divergente,
    coalesce(sum(m), 0) AS "somaDif",
    count(*) FILTER (WHERE m IS NULL) AS "semDif"`;
  const op = new Map();
  const opL = [];
  let de = primeiro;
  while (de <= ultimo) {
    const ate = somarDias(de, 30) > ultimo ? ultimo : somarDias(de, 30);
    console.log(`  operador ${de} … ${ate}`);
    const a = await query(
      `SELECT to_char(data_ref, 'YYYY-MM') AS mes, ${MAT} AS matricula, ${NOME} AS nome, ${AGG}
       FROM (SELECT data_ref, operador, ${MIN} AS m FROM cr_0108 WHERE data_ref >= $1::date AND data_ref <= $2::date) t
       GROUP BY 1, operador`,
      [de, ate]
    );
    for (const row of a.rows) {
      const k = `${row.mes}|${row.matricula}`;
      const cur = op.get(k) || { mes: row.mes, matricula: row.matricula, nome: row.nome || "", ...baldes({}) };
      const b = baldes(row);
      cur.noHorario += b.noHorario;
      cur.adiantado += b.adiantado;
      cur.atrasado += b.atrasado;
      cur.divergente += b.divergente;
      cur.total += b.total;
      cur.somaDif += b.somaDif;
      cur.semDif += b.semDif;
      if (row.nome) cur.nome = row.nome;
      op.set(k, cur);
    }
    const b = await query(
      `SELECT to_char(data_ref, 'YYYY-MM') AS mes, ${MAT} AS matricula, linha, ${AGG}
       FROM (SELECT data_ref, operador, linha, ${MIN} AS m FROM cr_0108 WHERE data_ref >= $1::date AND data_ref <= $2::date) t
       GROUP BY 1, operador, linha`,
      [de, ate]
    );
    for (const row of b.rows) {
      opL.push({
        m: row.mes, k: row.matricula, l: row.linha,
        n: n(row.noHorario), a: n(row.adiantado), t: n(row.atrasado),
        d: n(row.divergente), T: n(row.total), S: n(row.somaDif)
      });
    }
    de = somarDias(ate, 1);
  }
  const listaOp = [...op.values()].sort((x, y) => x.mes.localeCompare(y.mes) || String(x.matricula).localeCompare(String(y.matricula)));
  const listaL = opL.sort((x, y) => String(x.m).localeCompare(y.m) || String(x.k).localeCompare(y.k));
  gravar("por-mes-operador.json", listaOp);
  gravar("por-mes-operador-linha.json", listaL);
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  const cargas = await query(
    `SELECT min(data_ref)::text AS primeiro, max(data_ref)::text AS ultimo,
            coalesce(sum(linhas), 0) AS registros, count(*) AS dias
     FROM cr_0108_cargas`
  );
  const c = cargas.rows[0] || {};
  const primeiro = String(c.primeiro || "").slice(0, 10);
  const ultimo = String(c.ultimo || "").slice(0, 10);
  if (!ultimo) throw new Error("cr_0108_cargas vazia");
  console.log(`Cargas: ${primeiro} → ${ultimo} · ${c.dias} dias · ${c.registros} passagens`);

  const maxAgg = await iso(`SELECT max(data_ref)::text AS max FROM cr0108_dia_linha`);
  const desde = !maxAgg || maxAgg < ultimo ? (maxAgg ? somarDias(maxAgg, 1) : primeiro) : "";
  if (desde && desde <= ultimo) {
    try {
      await refreshAgregados(desde);
    } catch (err) {
      console.warn("Refresh dos agregados falhou (tabela/colunas?):", err.message);
    }
  } else {
    console.log("Agregados já no último dia das cargas.");
  }

  const porDiaLinha = await query(
    `SELECT data_ref::text AS data, linha,
            sum(total) AS total, sum(no_horario) AS "noHorario", sum(adiantado) AS adiantado,
            sum(atrasado) AS atrasado, sum(divergente) AS divergente,
            sum(soma_dif) AS "somaDif", sum(sem_dif) AS "semDif"
     FROM cr0108_dia_linha GROUP BY 1, 2 ORDER BY 1, 2`
  );
  const diaLinha = porDiaLinha.rows.map((r) => ({ data: String(r.data).slice(0, 10), linha: r.linha, ...baldes(r) }));
  gravar("por-dia-linha.json", diaLinha);

  const porDiaMap = new Map();
  for (const r of diaLinha) {
    const cur = porDiaMap.get(r.data) || { data: r.data, ...baldes({}) };
    cur.noHorario += r.noHorario;
    cur.adiantado += r.adiantado;
    cur.atrasado += r.atrasado;
    cur.divergente += r.divergente;
    cur.total += r.total;
    cur.somaDif += r.somaDif;
    cur.semDif += r.semDif;
    porDiaMap.set(r.data, cur);
  }
  const porDia = [...porDiaMap.values()].sort((a, b) => a.data.localeCompare(b.data));
  gravar("por-dia.json", porDia);

  const porHora = await query(
    `SELECT data_ref::text AS data, hora,
            sum(total) AS total, sum(no_horario) AS "noHorario", sum(adiantado) AS adiantado,
            sum(atrasado) AS atrasado, sum(divergente) AS divergente,
            sum(soma_dif) AS "somaDif", sum(sem_dif) AS "semDif"
     FROM cr0108_dia_hora GROUP BY 1, 2 ORDER BY 1, 2`
  );
  gravar("por-dia-hora.json", porHora.rows.map((r) => ({ data: String(r.data).slice(0, 10), hora: r.hora, ...baldes(r) })));

  const sentido = await query(
    `SELECT to_char(data_ref, 'YYYY-MM') AS mes, direcao AS sentido,
            sum(total) AS total, sum(no_horario) AS "noHorario", sum(adiantado) AS adiantado,
            sum(atrasado) AS atrasado, sum(divergente) AS divergente,
            sum(soma_dif) AS "somaDif", sum(sem_dif) AS "semDif"
     FROM cr0108_dia_linha GROUP BY 1, 2 ORDER BY 1, 2`
  );
  gravar("por-mes-sentido.json", sentido.rows.map((r) => ({ mes: r.mes, sentido: r.sentido, ...baldes(r) })));

  const velho = lerJson("meta.json", {});
  const linhas = { ...(velho.linhas || {}) };
  const novas = await query(
    `SELECT DISTINCT linha FROM cr_0108
     WHERE data_ref = (SELECT max(data_ref) FROM cr_0108_cargas) ORDER BY linha`
  );
  for (const row of novas.rows) if (row.linha && !(row.linha in linhas)) linhas[row.linha] = "";

  const ultimoAgg = porDia.length ? porDia[porDia.length - 1].data : ultimo;
  gravar("meta.json", {
    gerado: new Date().toISOString(),
    origem: "dsql",
    arquivos: Number(c.dias || 0),
    registros: Number(c.registros || 0),
    primeiroDia: primeiro,
    ultimoDia: ultimoAgg,
    linhas,
    regra: velho.regra || {
      noHorario: [-2, 6], adiantado: [-10, -3], atrasado: [7, 15],
      divergenteAcima: 16, divergenteAbaixo: -11
    }
  });

  if (COM_OPERADOR) {
    console.log("Ranking mensal de motoristas…");
    await exportarOperador(primeiro, ultimoAgg);
  }
  console.log(`JSON CR-0108 atualizado até ${ultimoAgg}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
