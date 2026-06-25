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

function firestoreDate(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  if (typeof valor.seconds === "number") return new Date(valor.seconds * 1000);
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function criarPerfisRegraImport(perfis) {
  const variantes = new Set();
  (Array.isArray(perfis) ? perfis : []).forEach((perfil) => {
    const original = String(perfil || "").trim();
    const semAcento = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    [original, semAcento, original.toLowerCase(), semAcento.toLowerCase()].forEach((item) => {
      if (item) variantes.add(item);
    });
  });
  return [...variantes];
}

export async function upsertAviso(pool, aviso) {
  const id = String(aviso.id || "").trim();
  if (!id) return;
  const inicioEm = firestoreDate(aviso.inicioEm);
  const fimEm = firestoreDate(aviso.fimEm);
  if (!inicioEm || !fimEm) return;
  const perfis = Array.isArray(aviso.perfis) ? aviso.perfis : [];
  const perfisRegra = criarPerfisRegraImport(aviso.perfisRegra || perfis);
  const usuarios = (Array.isArray(aviso.usuarios) ? aviso.usuarios : [])
    .map((email) => String(email || "").trim().toLowerCase())
    .filter(Boolean);
  const payload = {
    titulo: String(aviso.titulo || "").trim(),
    mensagem: String(aviso.mensagem || "").trim(),
    publico: aviso.publico === true,
    perfis,
    perfisRegra,
    perfisBusca: perfis.map((p) => String(p).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")),
    usuarios,
    autorEmail: String(aviso.autorEmail || "").trim().toLowerCase(),
    autorNome: String(aviso.autorNome || "").trim(),
    ativo: aviso.ativo !== false
  };
  const criadoEm = firestoreDate(aviso.criadoEm);
  const atualizadoEm = firestoreDate(aviso.atualizadoEm);
  await pool.query(
    `INSERT INTO avisos (
       id, payload, publico, ativo, inicio_em, fim_em, perfis_regra, usuarios, criado_em, atualizado_em
     ) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()), COALESCE($10, NOW()))
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       publico = EXCLUDED.publico,
       ativo = EXCLUDED.ativo,
       inicio_em = EXCLUDED.inicio_em,
       fim_em = EXCLUDED.fim_em,
       perfis_regra = EXCLUDED.perfis_regra,
       usuarios = EXCLUDED.usuarios,
       atualizado_em = COALESCE(EXCLUDED.atualizado_em, NOW())`,
    [
      id,
      JSON.stringify(payload),
      payload.publico,
      payload.ativo,
      inicioEm.toISOString(),
      fimEm.toISOString(),
      perfisRegra,
      usuarios,
      criadoEm?.toISOString() || null,
      atualizadoEm?.toISOString() || null
    ]
  );
}

export async function gravarLiberacaoLinhas(pool, linhas, { origem = "planilha" } = {}) {
  const BATCH_TX = 2500;
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
    const chunk = rows.slice(done, done + BATCH_TX);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of chunk) {
        await client.query(
          `INSERT INTO liberacao_linhas (data_iso, row_id, payload, atualizado_por, atualizado_em)
           VALUES ($1::date, $2, $3::jsonb, $4, NOW())
           ON CONFLICT (data_iso, row_id) DO UPDATE SET
             payload = EXCLUDED.payload,
             atualizado_em = NOW()`,
          [row.data_iso, row.row_id, JSON.stringify(row.payload), origem]
        );
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
