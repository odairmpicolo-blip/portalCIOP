import { Router } from "express";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";
import { mesclarLinhasTelemetria, agregarLinhasTelemetria, normalizarLinhaTelemetria } from "../lib/telemetria-merge.js";

const router = Router();
const LOTE_UPSERT = 50;
const LOTE_SELECT = 100;

function sanitizarLinha(row, dataIso, veiculo) {
  const payload = { ...row };
  payload.data_iso = dataIso;
  payload.veiculo_norm = veiculo;
  return payload;
}

function mesclarPayloadTelemetria(atual, novo) {
  return mesclarLinhasTelemetria(atual, novo);
}

function normalizarDataIsoResposta(val) {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s.slice(0, 10);
}

async function buscarPayloadsExistentes(chaves) {
  const mapa = new Map();
  for (let i = 0; i < chaves.length; i += LOTE_SELECT) {
    const lote = chaves.slice(i, i + LOTE_SELECT);
    const params = [];
    const tuples = lote.map(([dataIso, veiculo], idx) => {
      const a = idx * 2 + 1;
      params.push(dataIso, veiculo);
      return `($${a}::date, $${a + 1})`;
    }).join(", ");
    const sql = `SELECT data_iso, veiculo, payload FROM telemetria_linhas WHERE (data_iso, veiculo) IN (${tuples})`;
    const result = await query(sql, params);
    result.rows.forEach((r) => {
      mapa.set(
        `${normalizarDataIsoResposta(r.data_iso)}|${r.veiculo}`,
        r.payload
      );
    });
  }
  return mapa;
}

async function upsertTelemetriaLote(registros, origemArquivo, email) {
  if (!registros.length) return 0;
  const params = [];
  const values = registros.map((reg, idx) => {
    const base = idx * 5;
    params.push(reg.dataIso, reg.veiculo, JSON.stringify(reg.payloadFinal), origemArquivo || null, email || null);
    return `($${base + 1}::date, $${base + 2}, $${base + 3}::jsonb, $${base + 4}, $${base + 5}, NOW())`;
  }).join(", ");
  await query(
    `INSERT INTO telemetria_linhas (data_iso, veiculo, payload, origem_arquivo, atualizado_por, atualizado_em)
     VALUES ${values}
     ON CONFLICT (data_iso, veiculo) DO UPDATE SET
       payload = EXCLUDED.payload,
       origem_arquivo = EXCLUDED.origem_arquivo,
       atualizado_por = EXCLUDED.atualizado_por,
       atualizado_em = NOW()`,
    params
  );
  return registros.length;
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
      data_iso: normalizarDataIsoResposta(r.data_iso),
      veiculo: r.veiculo,
      payload: normalizarLinhaTelemetria(r.payload),
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
    const gruposImport = new Map();
    for (const item of linhas) {
      const dataIso = String(item?.data_iso || "").slice(0, 10);
      const veiculo = String(item?.veiculo || "").trim();
      const payload = item?.payload;
      if (!dataIso || !veiculo || !payload || typeof payload !== "object") continue;
      const clean = normalizarLinhaTelemetria(sanitizarLinha(payload, dataIso, veiculo));
      const key = `${dataIso}|${veiculo}`;
      if (!gruposImport.has(key)) gruposImport.set(key, []);
      gruposImport.get(key).push(clean);
    }

    const mapaImport = new Map();
    for (const [key, grupo] of gruposImport) {
      mapaImport.set(key, agregarLinhasTelemetria(grupo));
    }

    const chaves = [...mapaImport.entries()].map(([key]) => {
      const [dataIso, veiculo] = key.split("|");
      return [dataIso, veiculo];
    });
    const existentes = await buscarPayloadsExistentes(chaves);

    const registros = [...mapaImport.entries()].map(([key, mergedIncoming]) => {
      const [dataIso, veiculo] = key.split("|");
      const existente = existentes.get(key);
      const payloadFinal = existente
        ? mesclarPayloadTelemetria(existente, mergedIncoming)
        : mergedIncoming;
      return { dataIso, veiculo, payloadFinal };
    });

    let inseridos = 0;
    for (let i = 0; i < registros.length; i += LOTE_UPSERT) {
      inseridos += await upsertTelemetriaLote(
        registros.slice(i, i + LOTE_UPSERT),
        origemArquivo,
        req.user?.email || null
      );
    }

    res.json({ ok: true, inseridos, total: linhas.length, unificados: mapaImport.size });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
