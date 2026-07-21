import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";
import { enviarPdfRelatorioS3, montarChaveRelatorio, relatoriosS3Configurado } from "../lib/relatorios-s3.js";

const router = Router();
const MAX_PDF_BYTES = 12 * 1024 * 1024;

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function dataIsoValida(valor) {
  const s = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function decodeBase64Pdf(base64) {
  const limpo = String(base64 || "").replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
  if (!limpo) throw new Error("PDF base64 ausente");
  const buf = Buffer.from(limpo, "base64");
  if (!buf.length) throw new Error("PDF inválido");
  if (buf.length > MAX_PDF_BYTES) throw new Error("PDF acima de 12MB");
  return buf;
}

router.post("/upload", requireFirebaseUser, async (req, res) => {
  try {
    if (!relatoriosS3Configurado()) {
      res.status(503).json({ ok: false, erro: "Armazenamento S3 de relatórios não configurado" });
      return;
    }

    const userEmail = normalizarEmail(req.user?.email);
    if (!userEmail || userEmail === "api-key") {
      res.status(401).json({ ok: false, erro: "Usuário inválido" });
      return;
    }

    const filename = String(req.body?.filename || "relatorio.pdf").trim() || "relatorio.pdf";
    const dataDocumento = dataIsoValida(req.body?.dataDocumento);
    const protocolo = String(req.body?.protocolo || "").trim().slice(0, 80);
    const funcionarioRegistro = String(req.body?.funcionarioRegistro || "").trim().slice(0, 80);
    const funcionarioNome = String(req.body?.funcionarioNome || "").trim().slice(0, 180);
    const funcionarioTexto = String(req.body?.funcionarioTexto || "").trim().slice(0, 260);
    const origem = String(req.body?.origem || "pdf").trim().slice(0, 40) || "pdf";
    const criadoPorNome = String(req.body?.criadoPorNome || "").trim().slice(0, 180);
    const buffer = decodeBase64Pdf(req.body?.pdfBase64);

    const key = montarChaveRelatorio({
      userEmail,
      dataIso: dataDocumento,
      filename
    });

    const s3 = await enviarPdfRelatorioS3({
      key,
      buffer,
      metadata: {
        criadoPor: userEmail,
        protocolo,
        origem,
        dataDocumento
      }
    });

    const id = randomUUID();
    await query(
      `INSERT INTO relatorios_ocorrencia (
         id, user_email, data_documento, protocolo, funcionario_registro, funcionario_nome,
         funcionario_texto, nome_arquivo, storage_key, storage_uri, origem, criado_por_nome, criado_em
       ) VALUES (
         $1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
       )
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        userEmail,
        dataDocumento,
        protocolo || null,
        funcionarioRegistro || null,
        funcionarioNome || null,
        funcionarioTexto || null,
        filename,
        s3.key,
        s3.s3Uri,
        origem,
        criadoPorNome || null
      ]
    );

    res.json({
      ok: true,
      id,
      userEmail,
      dataDocumento,
      storageKey: s3.key,
      storageUri: s3.s3Uri,
      url: s3.url || ""
    });
  } catch (err) {
    console.error("relatorios/upload:", err);
    res.status(500).json({ ok: false, erro: err.message || "Falha ao salvar PDF" });
  }
});

router.get("/", requireFirebaseUser, async (req, res) => {
  try {
    const userEmail = normalizarEmail(req.user?.email);
    const de = String(req.query.de || "").slice(0, 10);
    const ate = String(req.query.ate || "").slice(0, 10);
    const params = [userEmail];
    let sql = `SELECT id, user_email, data_documento, protocolo, funcionario_registro, funcionario_nome,
                      funcionario_texto, nome_arquivo, storage_key, storage_uri, origem, criado_por_nome, criado_em
               FROM relatorios_ocorrencia
               WHERE user_email = $1`;
    if (de) {
      params.push(de);
      sql += ` AND data_documento >= $${params.length}::date`;
    }
    if (ate) {
      params.push(ate);
      sql += ` AND data_documento <= $${params.length}::date`;
    }
    sql += ` ORDER BY data_documento DESC, criado_em DESC LIMIT 200`;
    const result = await query(sql, params);
    res.json({
      ok: true,
      total: result.rows.length,
      dados: result.rows.map((r) => ({
        id: r.id,
        userEmail: r.user_email,
        dataDocumento: r.data_documento instanceof Date
          ? r.data_documento.toISOString().slice(0, 10)
          : String(r.data_documento || "").slice(0, 10),
        protocolo: r.protocolo || "",
        funcionarioRegistro: r.funcionario_registro || "",
        funcionarioNome: r.funcionario_nome || "",
        funcionarioTexto: r.funcionario_texto || "",
        nomeArquivo: r.nome_arquivo || "",
        storageKey: r.storage_key || "",
        storageUri: r.storage_uri || "",
        origem: r.origem || "",
        criadoPorNome: r.criado_por_nome || "",
        criadoEm: r.criado_em || null
      }))
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
