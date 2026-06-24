import { Router } from "express";
import { query } from "../db.js";
import { requireApiKey, requireFirebaseUser } from "../middleware/auth.js";

const router = Router();

router.get("/atual", requireFirebaseUser, async (_req, res) => {
  try {
    const result = await query(
      `SELECT payload, atualizado_em FROM terminais_snapshot WHERE id = 'atual' LIMIT 1`
    );
    if (!result.rows.length) {
      res.json({ ok: true, payload: null, total: 0, origem: "aws" });
      return;
    }
    const row = result.rows[0];
    res.json({
      ok: true,
      payload: row.payload,
      atualizadoEm: row.atualizado_em,
      origem: "aws"
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.put("/atual", requireApiKey, async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ ok: false, erro: "Payload inválido" });
    return;
  }
  try {
    await query(
      `INSERT INTO terminais_snapshot (id, payload, fonte, atualizado_em)
       VALUES ('atual', $1::jsonb, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         fonte = EXCLUDED.fonte,
         atualizado_em = NOW()`,
      [JSON.stringify(payload), payload.fonte || "import"]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
