/**
 * One-shot Lambda: índice CR-0108, duplicados, audit_log, backup/restore lógico.
 * Import: zip root → ./backend/src/db.js
 */
import { query, closePool } from "./backend/src/db.js";
import { putJsonS3 } from "./backend/src/lib/s3-json.js";

const BUCKET = "portal-ciop-relatorios-584342046935-sa-east-1";
const PREFIX = "dsql-backup/fase4-2026-08-20";

async function passo(nome, fn) {
  const t0 = Date.now();
  try {
    const dados = await fn();
    return { ok: true, nome, ms: Date.now() - t0, dados };
  } catch (e) {
    return { ok: false, nome, ms: Date.now() - t0, erro: String(e.message || e).slice(0, 500) };
  }
}

export async function handler() {
  const passos = [];
  try {
    passos.push(await passo("audit_log", async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id TEXT NOT NULL,
          quando TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          uid TEXT,
          tabela TEXT NOT NULL,
          chave TEXT NOT NULL,
          acao TEXT NOT NULL,
          antes JSONB,
          depois JSONB,
          PRIMARY KEY (id)
        )`);
      const n = await query("SELECT count(*)::int AS n FROM audit_log");
      return { linhas: n.rows[0].n };
    }));

    passos.push(await passo("duplicados", async () => {
      const cad = await query(`
        SELECT data_ref::text AS dia, registro, count(*)::int AS n
        FROM cr_0002
        WHERE btrim(coalesce(registro, '')) <> ''
        GROUP BY 1, 2
        HAVING count(*) > 1
        LIMIT 20`);
      const lib = await query(`
        SELECT data_iso::text AS dia, row_id, count(*)::int AS n
        FROM liberacao_linhas
        GROUP BY 1, 2
        HAVING count(*) > 1
        LIMIT 5`);
      return {
        cr_0002_registro_dia: cad.rows,
        liberacao_pk: lib.rows
      };
    }));

    passos.push(await passo("indice_cr_0108", async () => {
      const ja = await query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = 'idx_cr_0108_dia_veiculo'`);
      if (ja.rows.length) {
        const valid = await query(`
          SELECT i.indisvalid
          FROM pg_index i
          JOIN pg_class c ON c.oid = i.indexrelid
          WHERE c.relname = 'idx_cr_0108_dia_veiculo'`);
        return { jaExistia: true, valido: valid.rows[0]?.indisvalid, def: ja.rows[0].indexdef };
      }
      let criado;
      try {
        criado = await query(
          "CREATE INDEX ASYNC idx_cr_0108_dia_veiculo ON cr_0108 (data_ref, (btrim(veiculo)))"
        );
      } catch (e) {
        criado = await query(
          "CREATE INDEX ASYNC idx_cr_0108_dia_veiculo ON cr_0108 (data_ref, veiculo)"
        );
        criado._fallback = String(e.message).slice(0, 200);
      }
      const jobId = criado.rows?.[0]?.job_id || criado.rows?.[0]?.job_uuid || null;
      let espera = null;
      if (jobId) {
        try {
          espera = await query("SELECT sys.wait_for_job($1) AS ok", [jobId]);
        } catch (e) {
          espera = { erro: String(e.message).slice(0, 200) };
        }
      }
      const jobs = await query("SELECT job_id, status, details, job_type, object_name FROM sys.jobs");
      const valid = await query(`
        SELECT i.indisvalid
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = 'idx_cr_0108_dia_veiculo'`);
      return {
        createRows: criado.rows,
        fallback: criado._fallback || null,
        jobId,
        espera: espera?.rows || espera,
        jobs: jobs.rows,
        valido: valid.rows[0]?.indisvalid ?? null
      };
    }));

    passos.push(await passo("backup_restore", async () => {
      const avisos = await query("SELECT id, payload, publico, ativo FROM avisos");
      const cargas = await query(
        "SELECT data_ref::text AS dia, linhas, status FROM cr_0108_cargas ORDER BY data_ref"
      );
      const rel = await query(
        "SELECT id, user_email, data_documento::text AS data_documento, nome_arquivo FROM relatorios_ocorrencia"
      );
      const dump = {
        geradoEm: new Date().toISOString(),
        cluster: "ort34httzig7iktrneb4ytcy5u",
        avisos: avisos.rows,
        cr_0108_cargas: cargas.rows,
        relatorios_ocorrencia: rel.rows
      };
      let s3 = null;
      try {
        s3 = await putJsonS3(BUCKET, `${PREFIX}/nucleo.json`, dump);
      } catch (e) {
        s3 = `falhou: ${String(e.message).slice(0, 200)}`;
      }

      await query("DROP TABLE IF EXISTS fase4_restore_probe");
      await query(`
        CREATE TABLE fase4_restore_probe (
          id TEXT NOT NULL,
          payload JSONB NOT NULL,
          PRIMARY KEY (id)
        )`);
      await query("INSERT INTO fase4_restore_probe (id, payload) SELECT id, payload FROM avisos");
      const origem = await query("SELECT count(*)::int AS n FROM avisos");
      const sonda = await query("SELECT count(*)::int AS n FROM fase4_restore_probe");
      const ok = origem.rows[0].n === sonda.rows[0].n && origem.rows[0].n > 0;
      await query("DROP TABLE IF EXISTS fase4_restore_probe");
      return {
        s3,
        avisosOrigem: origem.rows[0].n,
        avisosRestaurados: sonda.rows[0].n,
        restoreOk: ok,
        cargasDias: cargas.rows.length
      };
    }));

    passos.push(await passo("audit_sonda", async () => {
      await query(
        `INSERT INTO audit_log (id, quando, uid, tabela, chave, acao, antes, depois)
         VALUES ('fase4-sonda', NOW(), 'fase4', 'audit_log', 'sonda', 'insert', NULL, '{"ok":true}'::jsonb)
         ON CONFLICT (id) DO UPDATE SET quando = NOW(), depois = EXCLUDED.depois`
      );
      const r = await query("SELECT id, uid, tabela, acao FROM audit_log WHERE id = 'fase4-sonda'");
      return r.rows[0] || null;
    }));

    const falhou = passos.some((p) => !p.ok);
    return { statusCode: falhou ? 500 : 200, body: JSON.stringify({ passos }) };
  } finally {
    await closePool();
  }
}
