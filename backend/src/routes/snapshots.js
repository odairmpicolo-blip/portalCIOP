import { Router } from "express";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { query } from "../db.js";
import { registrarAudit } from "../lib/audit.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { exigirObjeto } from "../lib/validar.js";
import { requireApiKey, requireFirebaseUser } from "../middleware/auth.js";

const router = Router();

let incidentesS3 = null;
function getIncidentesS3() {
  if (!incidentesS3) {
    incidentesS3 = new S3Client({ region: config.incidentesS3Region });
  }
  return incidentesS3;
}

function payloadParaPortal(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const { idsProcessados, idsDetalhesConsultados, ...rest } = payload;
  return rest;
}

function enviarSnapshot(req, res, body) {
  res.set("Cache-Control", "no-store");
  res.json(body);
}

async function lerIncidentesS3() {
  const bucket = String(config.incidentesS3Bucket || "").trim();
  if (!bucket) return null;
  const out = await getIncidentesS3().send(
    new GetObjectCommand({ Bucket: bucket, Key: config.incidentesS3Key })
  );
  const texto = await out.Body?.transformToString();
  if (!texto) return null;
  const payload = payloadParaPortal(JSON.parse(texto));
  const atualizadoEm = payload?.atualizadoEm || (out.LastModified ? out.LastModified.toISOString() : null);
  return { payload, atualizadoEm, origem: "s3" };
}

/** Tabelas de snapshot com chave fixa `atual`. */
const SINGLE_SNAPSHOTS = {
  incidentes: "incidentes_snapshot",
  autuacoes: "autuacoes_snapshot",
  folha: "folha_snapshot"
};

function tabelaSnapshot(nome) {
  const table = SINGLE_SNAPSHOTS[nome];
  if (!table) throw new HttpError(404, "Snapshot não encontrado", "NAO_ENCONTRADA");
  return table;
}

router.get("/pontualidade/:cenario", requireFirebaseUser, asyncHandler(async (req, res) => {
  const cenario = String(req.params.cenario || "").trim().toLowerCase();
  if (!cenario) throw new HttpError(400, "Cenário obrigatório", "PAYLOAD_INVALIDO");
  const result = await query(
    `SELECT payload, atualizado_em FROM pontualidade_snapshot WHERE cenario = $1 LIMIT 1`,
    [cenario]
  );
  if (!result.rows.length) {
    res.json({ ok: true, payload: null, origem: "aws" });
    return;
  }
  const row = result.rows[0];
  res.json({
    ok: true,
    payload: row.payload,
    atualizadoEm: row.atualizado_em,
    origem: "aws"
  });
}));

router.put("/pontualidade/:cenario", requireApiKey, asyncHandler(async (req, res) => {
  const cenario = String(req.params.cenario || "").trim().toLowerCase();
  const payload = exigirObjeto(req.body);
  if (!cenario) throw new HttpError(400, "Payload inválido", "PAYLOAD_INVALIDO");
  await query(
    `INSERT INTO pontualidade_snapshot (cenario, payload, atualizado_em)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (cenario) DO UPDATE SET
       payload = EXCLUDED.payload,
       atualizado_em = NOW()`,
    [cenario, JSON.stringify(payload)]
  );
  await registrarAudit({
    uid: "api-key",
    tabela: "pontualidade_snapshot",
    chave: cenario,
    acao: "update",
    depois: { bytes: JSON.stringify(payload).length }
  });
  res.json({ ok: true });
}));

router.get("/:nome", requireFirebaseUser, asyncHandler(async (req, res) => {
  const nome = String(req.params.nome || "").trim().toLowerCase();
  const table = tabelaSnapshot(nome);
  if (nome === "incidentes") {
    try {
      const s3 = await lerIncidentesS3();
      if (s3?.payload) {
        enviarSnapshot(req, res, {
          ok: true,
          payload: s3.payload,
          atualizadoEm: s3.atualizadoEm,
          origem: "aws"
        });
        return;
      }
    } catch (errS3) {
      console.warn("[snapshots/incidentes] S3 indisponível, tentando DSQL:", errS3.message);
    }
  }
  const result = await query(
    `SELECT payload, atualizado_em FROM ${table} WHERE id = 'atual' LIMIT 1`
  );
  if (!result.rows.length) {
    res.json({ ok: true, payload: null, origem: "aws" });
    return;
  }
  const row = result.rows[0];
  res.json({
    ok: true,
    payload: row.payload,
    atualizadoEm: row.atualizado_em,
    origem: "aws"
  });
}));

router.put("/:nome", requireApiKey, asyncHandler(async (req, res) => {
  const nome = String(req.params.nome || "").trim().toLowerCase();
  const table = tabelaSnapshot(nome);
  const payload = exigirObjeto(req.body);
  await query(
    `INSERT INTO ${table} (id, payload, atualizado_em)
     VALUES ('atual', $1::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       payload = EXCLUDED.payload,
       atualizado_em = NOW()`,
    [JSON.stringify(payload)]
  );
  await registrarAudit({
    uid: "api-key",
    tabela: table,
    chave: "atual",
    acao: "update",
    depois: { bytes: JSON.stringify(payload).length }
  });
  res.json({ ok: true });
}));

export default router;
