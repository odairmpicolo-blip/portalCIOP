import { randomUUID } from "node:crypto";
import { query } from "../db.js";

const MAX_JSON = 8000;
let tabelaOk = false;

export function recorteJson(valor) {
  if (valor == null) return null;
  const s = JSON.stringify(valor);
  if (s.length <= MAX_JSON) return valor;
  return { _truncado: true, bytes: s.length, trecho: s.slice(0, MAX_JSON) };
}

export async function garantirAuditLog() {
  if (tabelaOk) return;
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
  tabelaOk = true;
}

export async function registrarAudit({
  uid = null,
  tabela,
  chave,
  acao,
  antes = null,
  depois = null
}) {
  await garantirAuditLog();
  await query(
    `INSERT INTO audit_log (id, quando, uid, tabela, chave, acao, antes, depois)
     VALUES ($1, NOW(), $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [
      randomUUID(),
      uid || null,
      String(tabela),
      String(chave).slice(0, 400),
      String(acao).slice(0, 40),
      JSON.stringify(recorteJson(antes)),
      JSON.stringify(recorteJson(depois))
    ]
  );
}
