import { Router } from "express";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";

const router = Router();

function sanitizarLinha(row, dataIso, veiculo) {
  const payload = { ...row };
  payload.data_iso = dataIso;
  payload.veiculo_norm = veiculo;
  return payload;
}

router.get("/", requireFirebaseUser, async (req, res) => {
  const dataDe = String(req.query.de || "").slice(0, 10);
  const dataAte = String(req.query.ate || "").slice(0, 10);
  const veiculo = String(req.query.veiculo || "").trim();
  if (!dataDe || !dataAte || dataAte < dataDe) {
    res.status(400).json({ ok: false, erro: "Parâmetros de e ate obrigatórios (YYYY-MM-DD)" });
    return;
  }
  try {
    const params = [dataDe, dataAte];
    let sql = `SELECT data_iso, veiculo, payload, origem_arquivo, atualizado_em
               FROM telemetria_linhas
               WHERE data_iso >= $1::date AND data_iso <= $2::date`;
    if (veiculo) {
      params.push(veiculo);
      sql += ` AND veiculo = $3`;
    }
    sql += ` ORDER BY data_iso DESC, veiculo`;
    const result = await query(sql, params);
    const dados = result.rows.map((r) => ({
      data_iso: r.data_iso,
      veiculo: r.veiculo,
      payload: r.payload,
      origem_arquivo: r.origem_arquivo
    }));
    res.json({
      ok: true,
      dados,
      total: dados.length,
      origem: "aws",
      atualizadoEm: result.rows[0]?.atualizado_em || null
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.post("/import", requireFirebaseUser, async (req, res) => {
  const linhas = Array.isArray(req.body?.linhas) ? req.body.linhas : null;
  const origemArquivo = String(req.body?.origemArquivo || "").slice(0, 255);
  if (!linhas?.length) {
    res.status(400).json({ ok: false, erro: "Campo linhas obrigatório (array)" });
    return;
  }
  if (linhas.length > 5000) {
    res.status(400).json({ ok: false, erro: "Máximo de 5000 linhas por importação" });
    return;
  }
  try {
    let inseridos = 0;
    for (const item of linhas) {
      const dataIso = String(item?.data_iso || "").slice(0, 10);
      const veiculo = String(item?.veiculo || "").trim();
      const payload = item?.payload;
      if (!dataIso || !veiculo || !payload || typeof payload !== "object") continue;
      const clean = sanitizarLinha(payload, dataIso, veiculo);
      await query(
        `INSERT INTO telemetria_linhas (data_iso, veiculo, payload, origem_arquivo, atualizado_por, atualizado_em)
         VALUES ($1::date, $2, $3::jsonb, $4, $5, NOW())
         ON CONFLICT (data_iso, veiculo) DO UPDATE SET
           payload = EXCLUDED.payload,
           origem_arquivo = EXCLUDED.origem_arquivo,
           atualizado_por = EXCLUDED.atualizado_por,
           atualizado_em = NOW()`,
        [dataIso, veiculo, JSON.stringify(clean), origemArquivo || null, req.user?.email || null]
      );
      inseridos++;
    }
    res.json({ ok: true, inseridos, total: linhas.length });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
