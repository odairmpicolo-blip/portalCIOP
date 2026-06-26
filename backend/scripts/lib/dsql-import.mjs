import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AuroraDSQLPool } from "@aws/aurora-dsql-node-postgres-connector";

const backendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

export function loadDsqlEnv() {
  loadEnvFile(path.join(backendRoot, ".env"));
  return {
    clusterId: process.env.DSQL_CLUSTER_ID || "",
    region: process.env.DSQL_REGION || process.env.AWS_REGION || "sa-east-1",
    user: process.env.DSQL_USER || "admin"
  };
}

export function createDsqlPool() {
  const { clusterId, region, user } = loadDsqlEnv();
  if (!clusterId) throw new Error("Configure DSQL_CLUSTER_ID em backend/.env");
  const host = `${clusterId}.dsql.${region}.on.aws`;
  return new AuroraDSQLPool({
    host,
    user,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    retry: { maxRetries: 5 }
  });
}

export async function upsertSnapshot(pool, table, payload) {
  await pool.query(
    `INSERT INTO ${table} (id, payload, atualizado_em)
     VALUES ('atual', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, atualizado_em = NOW()`,
    [JSON.stringify(payload)]
  );
}

export async function lerSnapshot(pool, table, id = "atual") {
  const res = await pool.query(
    `SELECT payload, atualizado_em FROM ${table} WHERE id = $1 LIMIT 1`,
    [id]
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return {
    payload: row.payload,
    atualizadoEm: row.atualizado_em
  };
}

export async function upsertTerminais(pool, payload) {
  await pool.query(
    `INSERT INTO terminais_snapshot (id, payload, fonte, atualizado_em)
     VALUES ('atual', $1::jsonb, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       fonte = EXCLUDED.fonte,
       atualizado_em = NOW()`,
    [JSON.stringify(payload), payload.fonte || "planilha"]
  );
}

export async function upsertPontualidade(pool, cenario, payload) {
  await pool.query(
    `INSERT INTO pontualidade_snapshot (cenario, payload, atualizado_em)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (cenario) DO UPDATE SET payload = EXCLUDED.payload, atualizado_em = NOW()`,
    [cenario, JSON.stringify(payload)]
  );
}

async function insertLiberacaoLote(client, lote, origem) {
  if (!lote.length) return;
  const values = [];
  const params = [];
  lote.forEach((row, idx) => {
    const base = idx * 4;
    values.push(`($${base + 1}::date, $${base + 2}, $${base + 3}::jsonb, $${base + 4}, NOW())`);
    params.push(row.data_iso, row.row_id, JSON.stringify(row.payload), origem);
  });
  await client.query(
    `INSERT INTO liberacao_linhas (data_iso, row_id, payload, atualizado_por, atualizado_em)
     VALUES ${values.join(", ")}
     ON CONFLICT (data_iso, row_id) DO UPDATE SET
       payload = EXCLUDED.payload,
       atualizado_em = NOW()`,
    params
  );
}

export async function gravarLiberacaoLinhas(pool, linhas, { origem = "planilha" } = {}) {
  const TX_MAX_ROWS = 200;
  const INSERT_ROWS = 40;
  const rows = [];
  for (const { dataIso, row } of linhas) {
    const rowId = String(row?._row || "").trim();
    if (!rowId) continue;
    const payload = { ...row };
    delete payload._dirty;
    delete payload._syncErro;
    payload.data_iso = payload.data_iso || dataIso;
    payload.origem = payload.origem || origem;
    rows.push({ data_iso: dataIso, row_id: rowId, payload });
  }
  let done = 0;
  while (done < rows.length) {
    const chunk = rows.slice(done, done + TX_MAX_ROWS);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < chunk.length; i += INSERT_ROWS) {
        await insertLiberacaoLote(client, chunk.slice(i, i + INSERT_ROWS), origem);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    done += chunk.length;
  }
  return rows.length;
}
