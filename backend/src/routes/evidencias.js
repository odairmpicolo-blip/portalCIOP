import { Router } from "express";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";
import {
  apagarPrefixoS3,
  chaveEvidenciaDoUsuario,
  montarChaveEvidencia,
  relatorioExisteNoS3,
  relatoriosS3Configurado,
  urlAssinadaRelatorioS3,
  urlPresignPutS3
} from "../lib/relatorios-s3.js";

const router = Router();
const EMAILS_OK = new Set(["odair.marin@icloud.com"]);

const CAMPOS = [
  "status",
  "lote",
  "origem",
  "autoNumero",
  "notificacao",
  "protocolo",
  "autoId",
  "data",
  "horario",
  "carro",
  "placa",
  "linha",
  "linhaNome",
  "local",
  "matricula",
  "motorista",
  "autuador",
  "motivo",
  "texto1",
  "texto2",
  "texto3",
  "obs",
  "ordemPdf",
  "planilhaLinha",
  "planilhaAcao",
  "atualizadoEm"
];

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function podeAcessar(email) {
  return EMAILS_OK.has(normalizarEmail(email));
}

function exigirUsuario(req, res) {
  const email = normalizarEmail(req.user?.email);
  if (!email || email === "api-key" || !podeAcessar(email)) {
    res.status(403).json({ ok: false, erro: "Sem permissão para evidências" });
    return "";
  }
  return email;
}

function idSeguro(valor) {
  return String(valor || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 80);
}

function slotSeguro(valor) {
  return String(valor || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 80);
}

function payloadLimpo(body = {}) {
  const out = {};
  CAMPOS.forEach((campo) => {
    const v = body[campo];
    out[campo] = v == null ? "" : v;
  });
  const imagens = Array.isArray(body.imagens) ? body.imagens : [];
  out.imagens = imagens
    .map((img) => ({
      id: String(img?.id || "").slice(0, 80),
      tipo: String(img?.tipo || "evidencia").slice(0, 40),
      key: String(img?.key || img?.path || "").slice(0, 400),
      fp: String(img?.fp || "").slice(0, 120)
    }))
    .filter((img) => img.id && img.key);
  out.paginaAutoKey = String(body.paginaAutoKey || body.paginaAutoPath || "").slice(0, 400);
  out.paginaNotifKey = String(body.paginaNotifKey || body.paginaNotifPath || "").slice(0, 400);
  out.paginaAutoFp = String(body.paginaAutoFp || "").slice(0, 120);
  out.paginaNotifFp = String(body.paginaNotifFp || "").slice(0, 120);
  return out;
}

function mapearLinha(row) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  return {
    id: row.id,
    userEmail: row.user_email,
    ...payload,
    status: row.status || payload.status || "",
    protocolo: row.protocolo || payload.protocolo || "",
    autoId: row.auto_id || payload.autoId || "",
    carro: row.carro || payload.carro || "",
    linha: row.linha || payload.linha || "",
    data: row.data_br || payload.data || "",
    atualizadoEm: payload.atualizadoEm || row.atualizado_em || ""
  };
}

let tabelaOk = false;
async function garantirTabela() {
  if (tabelaOk) return;
  await query(`
    CREATE TABLE IF NOT EXISTS evidencias_autuacoes (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      status TEXT,
      protocolo TEXT,
      auto_id TEXT,
      carro TEXT,
      linha TEXT,
      data_br TEXT,
      payload JSONB NOT NULL,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  try {
    await query("CREATE INDEX ASYNC idx_evidencias_user ON evidencias_autuacoes (user_email)");
  } catch (_) {
    /* índice já existe */
  }
  tabelaOk = true;
}

router.post("/presign", requireFirebaseUser, async (req, res) => {
  try {
    const userEmail = exigirUsuario(req, res);
    if (!userEmail) return;
    if (!relatoriosS3Configurado()) {
      res.status(503).json({ ok: false, erro: "S3 de evidências não configurado" });
      return;
    }
    const autoId = idSeguro(req.body?.id || req.body?.autoId);
    const slot = slotSeguro(req.body?.slot);
    const contentType = String(req.body?.contentType || "image/jpeg").slice(0, 80);
    if (!autoId || !slot) {
      res.status(400).json({ ok: false, erro: "id e slot obrigatórios" });
      return;
    }
    if (!/^image\//i.test(contentType)) {
      res.status(400).json({ ok: false, erro: "Tipo de arquivo inválido" });
      return;
    }
    const key = montarChaveEvidencia({ userEmail, autoId, slot });
    const uploadUrl = await urlPresignPutS3(key, contentType);
    res.json({ ok: true, key, uploadUrl, contentType, id: autoId, slot });
  } catch (err) {
    console.error("evidencias/presign:", err);
    res.status(500).json({ ok: false, erro: err.message || "Falha ao assinar upload" });
  }
});

router.get("/", requireFirebaseUser, async (req, res) => {
  try {
    const userEmail = exigirUsuario(req, res);
    if (!userEmail) return;
    await garantirTabela();
    const result = await query(
      `SELECT id, user_email, status, protocolo, auto_id, carro, linha, data_br, payload, atualizado_em
       FROM evidencias_autuacoes
       WHERE user_email = $1
       ORDER BY atualizado_em DESC
       LIMIT 400`,
      [userEmail]
    );
    res.json({ ok: true, total: result.rows.length, dados: result.rows.map(mapearLinha) });
  } catch (err) {
    console.error("evidencias GET:", err);
    res.status(500).json({ ok: false, erro: err.message || "Falha ao listar evidências" });
  }
});

router.get("/:id/download", requireFirebaseUser, async (req, res) => {
  try {
    const userEmail = exigirUsuario(req, res);
    if (!userEmail) return;
    if (!relatoriosS3Configurado()) {
      res.status(503).json({ ok: false, erro: "S3 de evidências não configurado" });
      return;
    }
    const key = String(req.query.key || "").trim();
    if (!chaveEvidenciaDoUsuario(key, userEmail)) {
      res.status(403).json({ ok: false, erro: "Chave inválida" });
      return;
    }
    const url = await urlAssinadaRelatorioS3(key, 60 * 30);
    res.json({ ok: true, url, key });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message || "Falha no download" });
  }
});

router.get("/:id", requireFirebaseUser, async (req, res) => {
  try {
    const userEmail = exigirUsuario(req, res);
    if (!userEmail) return;
    await garantirTabela();
    const id = idSeguro(req.params.id);
    const result = await query(
      `SELECT id, user_email, status, protocolo, auto_id, carro, linha, data_br, payload, atualizado_em
       FROM evidencias_autuacoes
       WHERE id = $1 AND user_email = $2
       LIMIT 1`,
      [id, userEmail]
    );
    if (!result.rows[0]) {
      res.status(404).json({ ok: false, erro: "Evidência não encontrada" });
      return;
    }
    res.json({ ok: true, evidencias: mapearLinha(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message || "Falha ao ler evidência" });
  }
});

router.put("/:id", requireFirebaseUser, async (req, res) => {
  try {
    const userEmail = exigirUsuario(req, res);
    if (!userEmail) return;
    await garantirTabela();
    const id = idSeguro(req.params.id || req.body?.id);
    if (!id) {
      res.status(400).json({ ok: false, erro: "ID inválido" });
      return;
    }
    const payload = payloadLimpo({ ...req.body, id });
    const keys = [
      payload.paginaAutoKey,
      payload.paginaNotifKey,
      ...payload.imagens.map((img) => img.key)
    ].filter(Boolean);
    for (const key of keys) {
      if (!chaveEvidenciaDoUsuario(key, userEmail)) {
        res.status(403).json({ ok: false, erro: "Chave S3 inválida" });
        return;
      }
      const existe = await relatorioExisteNoS3(key);
      if (!existe) {
        res.status(400).json({ ok: false, erro: `Arquivo ainda não está no S3: ${key}` });
        return;
      }
    }
    payload.id = id;
    payload.atualizadoEm = payload.atualizadoEm || new Date().toISOString();
    payload.atualizadoPor = userEmail;
    await query(
      `INSERT INTO evidencias_autuacoes (
         id, user_email, status, protocolo, auto_id, carro, linha, data_br, payload, atualizado_em
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, COALESCE($10::timestamptz, NOW())
       )
       ON CONFLICT (id) DO UPDATE SET
         user_email = EXCLUDED.user_email,
         status = EXCLUDED.status,
         protocolo = EXCLUDED.protocolo,
         auto_id = EXCLUDED.auto_id,
         carro = EXCLUDED.carro,
         linha = EXCLUDED.linha,
         data_br = EXCLUDED.data_br,
         payload = EXCLUDED.payload,
         atualizado_em = EXCLUDED.atualizado_em`,
      [
        id,
        userEmail,
        String(payload.status || "").slice(0, 40),
        String(payload.protocolo || payload.notificacao || "").slice(0, 80),
        String(payload.autoId || "").slice(0, 40),
        String(payload.carro || "").slice(0, 40),
        String(payload.linha || "").slice(0, 40),
        String(payload.data || "").slice(0, 20),
        JSON.stringify(payload),
        payload.atualizadoEm
      ]
    );
    res.json({ ok: true, id, evidencias: payload });
  } catch (err) {
    console.error("evidencias PUT:", err);
    res.status(500).json({ ok: false, erro: err.message || "Falha ao gravar evidência" });
  }
});

router.delete("/:id", requireFirebaseUser, async (req, res) => {
  try {
    const userEmail = exigirUsuario(req, res);
    if (!userEmail) return;
    const id = idSeguro(req.params.id);
    if (!id) {
      res.status(400).json({ ok: false, erro: "ID inválido" });
      return;
    }
    await garantirTabela();
    await query("DELETE FROM evidencias_autuacoes WHERE id = $1 AND user_email = $2", [id, userEmail]);
    if (relatoriosS3Configurado()) {
      const amostra = montarChaveEvidencia({ userEmail, autoId: id, slot: "x" });
      await apagarPrefixoS3(amostra.replace(/\/x\.jpg$/, "/"));
    }
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message || "Falha ao excluir" });
  }
});

export default router;
