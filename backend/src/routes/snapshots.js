import { Router } from "express";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { query } from "../db.js";
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

function isoQuery(valor) {
  const s = String(valor || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function dataIsoIncidente(row) {
  const bruto = String(row?.data || row?.dataHora || row?.createdAt || "").trim();
  const datePart = bruto.split(/\s+/)[0] || "";
  const br = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(datePart)) return datePart.slice(0, 10);
  return "";
}

function recortarIncidentes(payload, de, ate) {
  if (!payload || typeof payload !== "object") return payload;
  if (!de && !ate) return payload;
  const lista = Array.isArray(payload.incidentes) ? payload.incidentes : [];
  const incidentes = lista.filter((row) => {
    const iso = dataIsoIncidente(row);
    if (!iso) return false;
    if (de && iso < de) return false;
    if (ate && iso > ate) return false;
    return true;
  });
  return { ...payload, incidentes, totalExtraido: incidentes.length };
}

function enviarSnapshot(req, res, body) {
  res.set("Cache-Control", "no-store");
  res.json(body);
}

let cacheIncidentesS3 = { ts: 0, value: null };

async function lerObjetoIncidentes(key) {
  const bucket = String(config.incidentesS3Bucket || "").trim();
  if (!bucket || !key) return null;
  const out = await getIncidentesS3().send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const texto = await out.Body?.transformToString();
  if (!texto) return null;
  const payload = payloadParaPortal(JSON.parse(texto));
  const atualizadoEm = payload?.atualizadoEm || (out.LastModified ? out.LastModified.toISOString() : null);
  return { payload, atualizadoEm, origem: "s3" };
}

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

async function lerIncidentesS3() {
  if (cacheIncidentesS3.value && Date.now() - cacheIncidentesS3.ts < 45000) {
    return cacheIncidentesS3.value;
  }
  const key = String(config.incidentesS3Key || "").trim();
  const value = await lerObjetoIncidentes(key);
  if (value) cacheIncidentesS3 = { ts: Date.now(), value };
  return value;
}

async function lerIncidentesS3Dia(de, ate) {
  if (de && ate && de === ate && de === hojeSP()) {
    try {
      const hoje = await lerObjetoIncidentes("incidentes-hoje.json");
      const recorte = hoje?.payload ? recortarIncidentes(hoje.payload, de, ate) : null;
      if (Array.isArray(recorte?.incidentes) && recorte.incidentes.length) {
        return { ...hoje, payload: recorte };
      }
    } catch (_) { /* cai no arquivo completo */ }
  }
  return lerIncidentesS3();
}

function queryDoPedido(req) {
  const q = { ...(req.query || {}) };
  const ev = req.apiGateway?.event;
  const params = ev?.queryStringParameters;
  if (params && typeof params === "object") {
    for (const [k, v] of Object.entries(params)) {
      if (q[k] == null || q[k] === "") q[k] = v;
    }
  }
  if (typeof ev?.rawQueryString === "string" && ev.rawQueryString) {
    const sp = new URLSearchParams(ev.rawQueryString);
    for (const [k, v] of sp.entries()) {
      if (q[k] == null || q[k] === "") q[k] = v;
    }
  }
  return q;
}

async function responderIncidentes(req, res, de, ate) {
  try {
    const s3 = await lerIncidentesS3Dia(de, ate);
    if (s3?.payload) {
      enviarSnapshot(req, res, {
        ok: true,
        payload: recortarIncidentes(s3.payload, de, ate),
        atualizadoEm: s3.atualizadoEm,
        origem: "aws"
      });
      return;
    }
  } catch (errS3) {
    console.warn("[snapshots/incidentes] S3 indisponível, tentando DSQL:", errS3.message);
  }
  const result = await query(
    `SELECT payload, atualizado_em FROM incidentes_snapshot WHERE id = 'atual' LIMIT 1`
  );
  if (!result.rows.length) {
    res.json({ ok: true, payload: null, origem: "aws" });
    return;
  }
  const row = result.rows[0];
  enviarSnapshot(req, res, {
    ok: true,
    payload: recortarIncidentes(row.payload, de, ate),
    atualizadoEm: row.atualizado_em,
    origem: "aws"
  });
}

/** Tabelas de snapshot com chave fixa `atual`. */
const SINGLE_SNAPSHOTS = {
  incidentes: "incidentes_snapshot",
  autuacoes: "autuacoes_snapshot",
  folha: "folha_snapshot"
};

router.get("/incidentes/dia/:dia", requireFirebaseUser, async (req, res) => {
  const dia = isoQuery(req.params.dia);
  if (!dia) {
    res.status(400).json({ ok: false, erro: "Dia inválido (YYYY-MM-DD)" });
    return;
  }
  try {
    await responderIncidentes(req, res, dia, dia);
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.get("/:nome", requireFirebaseUser, async (req, res) => {
  const nome = String(req.params.nome || "").trim().toLowerCase();
  const table = SINGLE_SNAPSHOTS[nome];
  if (!table) {
    res.status(404).json({ ok: false, erro: "Snapshot não encontrado" });
    return;
  }
  const q = queryDoPedido(req);
  const de = nome === "incidentes" ? isoQuery(q.de) : "";
  const ate = nome === "incidentes" ? isoQuery(q.ate) : "";
  try {
    if (nome === "incidentes") {
      await responderIncidentes(req, res, de, ate);
      return;
    }
    const result = await query(
      `SELECT payload, atualizado_em FROM ${table} WHERE id = 'atual' LIMIT 1`
    );
    if (!result.rows.length) {
      res.json({ ok: true, payload: null, origem: "aws" });
      return;
    }
    const row = result.rows[0];
    const payload = nome === "incidentes" ? recortarIncidentes(row.payload, de, ate) : row.payload;
    res.json({
      ok: true,
      payload,
      atualizadoEm: row.atualizado_em,
      origem: "aws"
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.put("/:nome", requireApiKey, async (req, res) => {
  const nome = String(req.params.nome || "").trim().toLowerCase();
  const table = SINGLE_SNAPSHOTS[nome];
  if (!table) {
    res.status(404).json({ ok: false, erro: "Snapshot não encontrado" });
    return;
  }
  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ ok: false, erro: "Payload inválido" });
    return;
  }
  try {
    await query(
      `INSERT INTO ${table} (id, payload, atualizado_em)
       VALUES ('atual', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         atualizado_em = NOW()`,
      [JSON.stringify(payload)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.get("/pontualidade/:cenario", requireFirebaseUser, async (req, res) => {
  const cenario = String(req.params.cenario || "").trim().toLowerCase();
  if (!cenario) {
    res.status(400).json({ ok: false, erro: "Cenário obrigatório" });
    return;
  }
  try {
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
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

router.put("/pontualidade/:cenario", requireApiKey, async (req, res) => {
  const cenario = String(req.params.cenario || "").trim().toLowerCase();
  const payload = req.body;
  if (!cenario || !payload || typeof payload !== "object") {
    res.status(400).json({ ok: false, erro: "Payload inválido" });
    return;
  }
  try {
    await query(
      `INSERT INTO pontualidade_snapshot (cenario, payload, atualizado_em)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (cenario) DO UPDATE SET
         payload = EXCLUDED.payload,
         atualizado_em = NOW()`,
      [cenario, JSON.stringify(payload)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
