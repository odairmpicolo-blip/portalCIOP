import { Router } from "express";
import { query } from "../db.js";
import { asyncHandler } from "../lib/http.js";
import { garantirAuditLog } from "../lib/audit.js";
import { requireAdministrador } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAdministrador, asyncHandler(async (req, res) => {
  await garantirAuditLog();
  const limite = Math.min(200, Math.max(1, Number(req.query.limite) || 80));
  const result = await query(
    `SELECT id, quando, uid, tabela, chave, acao
     FROM audit_log
     ORDER BY quando DESC
     LIMIT $1`,
    [limite]
  );
  res.json({
    ok: true,
    total: result.rows.length,
    itens: result.rows.map((r) => ({
      id: r.id,
      quando: r.quando,
      uid: r.uid || "",
      tabela: r.tabela,
      chave: r.chave,
      acao: r.acao
    }))
  });
}));

export default router;
