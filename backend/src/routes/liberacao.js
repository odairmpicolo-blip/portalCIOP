import { Router } from "express";
import { query } from "../db.js";
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

function dataIsoDb(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function payloadLinhaDsql(row) {
  const payload = row?.payload && typeof row.payload === "object" ? { ...row.payload } : {};
  const rowId = String(row?.row_id || "").trim();
  if (rowId && !payload._row) payload._row = rowId;
  if (!payload.data_iso) payload.data_iso = dataIsoDb(row?.data_iso);
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

router.get("/", requireFirebaseUser, async (req, res) => {
  const dataDe = String(req.query.de || "").slice(0, 10);
  const dataAte = String(req.query.ate || "").slice(0, 10);
  if (!dataDe || !dataAte || dataAte < dataDe) {
    res.status(400).json({ ok: false, erro: "Parâmetros de e ate obrigatórios (YYYY-MM-DD)" });
    return;
  }
  try {
    const result = await query(
      `SELECT data_iso, row_id, payload FROM liberacao_linhas
       WHERE data_iso >= $1::date AND data_iso <= $2::date
       ORDER BY data_iso, row_id`,
      [dataDe, dataAte]
    );
    const dados = result.rows.map(payloadLinhaDsql);
    res.json({ ok: true, dados, total: dados.length, origem: "aws" });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.put("/:dataIso/:rowId", requireFirebaseUser, async (req, res) => {
  const dataIso = String(req.params.dataIso || "").slice(0, 10);
  const rowId = String(req.params.rowId || "").trim();
  const payload = req.body;
  if (!dataIso || !rowId || !payload || typeof payload !== "object") {
    res.status(400).json({ ok: false, erro: "Payload inválido" });
    return;
  }
  try {
    const clean = sanitizarPayload(payload, dataIso);
    clean._row = rowId;
    clean.origem = "portal";
    await upsertLinha(dataIso, rowId, clean, req.user?.email || null);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.post("/planilha-linha", requireFirebaseUser, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ ok: false, erro: "Payload inválido" });
    return;
  }
  try {
    const planilha = await enviarLinhaPlanilha(payload);
    res.json({ ok: true, planilha });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.post("/import-planilha", requireFirebaseUser, async (req, res) => {
  const data = String(req.query.data || req.body?.data || "").slice(0, 10);
  const dataDe = String(req.query.de || req.body?.de || data).slice(0, 10);
  const dataAte = String(req.query.ate || req.body?.ate || data).slice(0, 10);
  if (!dataDe || !dataAte || dataAte < dataDe) {
    res.status(400).json({ ok: false, erro: "Informe data ou de/ate (YYYY-MM-DD)" });
    return;
  }
  try {
    const total = await importarPlanilhaParaDsql(
      dataDe,
      dataAte,
      req.user?.email || "import-planilha"
    );
    res.json({ ok: true, total, data_de: dataDe, data_ate: dataAte });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.post("/sync-dia/:dataIso", requireFirebaseUser, async (req, res) => {
  const dataIso = String(req.params.dataIso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
    res.status(400).json({ ok: false, erro: "Data inválida" });
    return;
  }
  try {
    const total = await importarPlanilhaParaDsql(dataIso, dataIso, req.user?.email || "sync-dia");
    const result = await query(
      `SELECT data_iso, row_id, payload FROM liberacao_linhas
       WHERE data_iso = $1::date ORDER BY row_id`,
      [dataIso]
    );
    res.json({
      ok: true,
      total,
      dados: result.rows.map(payloadLinhaDsql)
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

/** Sync planilha → DSQL (cron/Lambda via API key). */
router.post("/internal/sync-hoje", requireApiKey, async (_req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    const total = await importarPlanilhaParaDsql(hoje, hoje, "lambda-sync");
    res.json({ ok: true, total, data: hoje });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
