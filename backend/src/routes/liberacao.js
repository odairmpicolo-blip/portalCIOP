import { Router } from "express";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";

const router = Router();

router.get("/", requireFirebaseUser, async (req, res) => {
  const dataDe = String(req.query.de || "").slice(0, 10);
  const dataAte = String(req.query.ate || "").slice(0, 10);
  if (!dataDe || !dataAte || dataAte < dataDe) {
    res.status(400).json({ ok: false, erro: "Parâmetros de e ate obrigatórios (YYYY-MM-DD)" });
    return;
  }
  try {
    const result = await query(
      `SELECT payload FROM liberacao_linhas
       WHERE data_iso >= $1::date AND data_iso <= $2::date
       ORDER BY data_iso, row_id`,
      [dataDe, dataAte]
    );
    const dados = result.rows.map((r) => r.payload);
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
    await query(
      `INSERT INTO liberacao_linhas (data_iso, row_id, payload, atualizado_por, atualizado_em)
       VALUES ($1::date, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (data_iso, row_id) DO UPDATE SET
         payload = EXCLUDED.payload,
         atualizado_por = EXCLUDED.atualizado_por,
         atualizado_em = NOW()`,
      [dataIso, rowId, JSON.stringify(payload), req.user?.email || null]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
