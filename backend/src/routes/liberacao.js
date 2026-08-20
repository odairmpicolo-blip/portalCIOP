import { Router } from "express";
import { query } from "../db.js";
import { asyncHandler, HttpError } from "../lib/http.js";
import { exigirDataIso, exigirObjeto, intervaloDatas } from "../lib/validar.js";
import { requireApiKey, requireFirebaseUser } from "../middleware/auth.js";
import {
  buscarLiberacaoPlanilhaDia,
  enviarLinhaPlanilha,
  listarDatasIso
} from "../lib/liberacao-planilha.js";

const router = Router();

function sanitizarPayload(row, dataIso) {
  const payload = { ...row };
  delete payload._dirty;
  delete payload._syncErro;
  delete payload._ultimoCampoEditado;
  if (!payload.data_iso) payload.data_iso = dataIso;
  return payload;
}

async function upsertLinha(dataIso, rowId, payload, origem) {
  await query(
    `INSERT INTO liberacao_linhas (data_iso, row_id, payload, atualizado_por, atualizado_em)
     VALUES ($1::date, $2, $3::jsonb, $4, NOW())
     ON CONFLICT (data_iso, row_id) DO UPDATE SET
       payload = EXCLUDED.payload,
       atualizado_por = EXCLUDED.atualizado_por,
       atualizado_em = NOW()`,
    [dataIso, rowId, JSON.stringify(payload), origem]
  );
}

export async function importarPlanilhaParaDsql(dataDe, dataAte, origem) {
  const dias = dataDe === dataAte ? [dataDe] : listarDatasIso(dataDe, dataAte);
  let total = 0;
  for (const dia of dias) {
    const linhas = await buscarLiberacaoPlanilhaDia(dia);
    for (const row of linhas) {
      const rowId = String(row?._row || "").trim();
      if (!rowId) continue;
      await upsertLinha(dia, rowId, sanitizarPayload(row, dia), origem);
      total += 1;
    }
  }
  return total;
}

router.get("/", requireFirebaseUser, asyncHandler(async (req, res) => {
  const { de: dataDe, ate: dataAte } = intervaloDatas(req.query.de, req.query.ate);
  const result = await query(
    `SELECT payload FROM liberacao_linhas
     WHERE data_iso >= $1::date AND data_iso <= $2::date
     ORDER BY data_iso, row_id`,
    [dataDe, dataAte]
  );
  const dados = result.rows.map((r) => r.payload);
  res.json({ ok: true, dados, total: dados.length, origem: "aws" });
}));

router.put("/:dataIso/:rowId", requireFirebaseUser, asyncHandler(async (req, res) => {
  const dataIso = exigirDataIso(req.params.dataIso);
  const rowId = String(req.params.rowId || "").trim();
  const payload = exigirObjeto(req.body);
  if (!rowId) throw new HttpError(400, "Payload inválido", "PAYLOAD_INVALIDO");
  const clean = sanitizarPayload(payload, dataIso);
  clean._row = rowId;
  clean.origem = "portal";
  await upsertLinha(dataIso, rowId, clean, req.user?.email || null);
  res.json({ ok: true });
}));

router.post("/planilha-linha", requireFirebaseUser, asyncHandler(async (req, res) => {
  const payload = exigirObjeto(req.body);
  const planilha = await enviarLinhaPlanilha(payload);
  res.json({ ok: true, planilha });
}));

router.post("/import-planilha", requireFirebaseUser, asyncHandler(async (req, res) => {
  const data = req.query.data || req.body?.data || "";
  const { de: dataDe, ate: dataAte } = intervaloDatas(
    req.query.de || req.body?.de || data,
    req.query.ate || req.body?.ate || data
  );
  const total = await importarPlanilhaParaDsql(
    dataDe,
    dataAte,
    req.user?.email || "import-planilha"
  );
  res.json({ ok: true, total, data_de: dataDe, data_ate: dataAte });
}));

router.post("/sync-dia/:dataIso", requireFirebaseUser, asyncHandler(async (req, res) => {
  const dataIso = exigirDataIso(req.params.dataIso);
  const total = await importarPlanilhaParaDsql(dataIso, dataIso, req.user?.email || "sync-dia");
  const result = await query(
    `SELECT payload FROM liberacao_linhas
     WHERE data_iso = $1::date ORDER BY row_id`,
    [dataIso]
  );
  res.json({
    ok: true,
    total,
    dados: result.rows.map((r) => r.payload)
  });
}));

/** Sync planilha → DSQL (cron/Lambda via API key). */
router.post("/internal/sync-hoje", requireApiKey, asyncHandler(async (_req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const total = await importarPlanilhaParaDsql(hoje, hoje, "lambda-sync");
  res.json({ ok: true, total, data: hoje });
}));

export default router;
