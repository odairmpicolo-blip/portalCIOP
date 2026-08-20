import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { registrarAudit } from "../lib/audit.js";
import { HttpError } from "../lib/http.js";
import { ehDataIso, intervaloDatas } from "../lib/validar.js";
import { requireFirebaseUser } from "../middleware/auth.js";
import {
  enviarPdfRelatorioS3,
  listarPdfsRelatorioS3,
  montarChaveRelatorio,
  relatorioExisteNoS3,
  relatoriosS3Configurado,
  urlAssinadaRelatorioS3,
  urlPresignPutRelatorioS3
} from "../lib/relatorios-s3.js";

const router = Router();
const MAX_PDF_BYTES = 12 * 1024 * 1024;

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function dataIsoValida(valor) {
  const s = String(valor || "").trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    if (!ehDataIso(s)) throw new HttpError(400, "Data inválida (YYYY-MM-DD)", "DATA_INVALIDA");
    return s;
  }
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const iso = `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    if (!ehDataIso(iso)) throw new HttpError(400, "Data inválida", "DATA_INVALIDA");
    return iso;
  }
  throw new HttpError(400, "Data inválida (YYYY-MM-DD)", "DATA_INVALIDA");
}

function camposUpload(body) {
  return {
    filename: String(body?.filename || "relatorio.pdf").trim() || "relatorio.pdf",
    dataDocumento: dataIsoValida(body?.dataDocumento),
    protocolo: String(body?.protocolo || "").trim().slice(0, 80),
    funcionarioRegistro: String(body?.funcionarioRegistro || "").trim().slice(0, 80),
    funcionarioNome: String(body?.funcionarioNome || "").trim().slice(0, 180),
    funcionarioTexto: String(body?.funcionarioTexto || "").trim().slice(0, 260),
    origem: String(body?.origem || "pdf").trim().slice(0, 40) || "pdf",
    criadoPorNome: String(body?.criadoPorNome || "").trim().slice(0, 180)
  };
}

function chaveDoUsuario(key, userEmail) {
  const esperado = montarChaveRelatorio({ userEmail, dataIso: "2000-01-01", filename: "x.pdf" })
    .replace(/\/2000-01-01\/x\.pdf$/, "/");
  return String(key || "").startsWith(esperado);
}

function decodeBase64Pdf(base64) {
  const limpo = String(base64 || "").replace(/^data:application\/pdf;base64,/i, "").replace(/\s+/g, "");
  if (!limpo) throw new Error("PDF base64 ausente");
  const buf = Buffer.from(limpo, "base64");
  if (!buf.length) throw new Error("PDF inválido");
  if (buf.length > MAX_PDF_BYTES) throw new Error("PDF acima de 12MB");
  return buf;
}

let tabelaOk = false;
async function garantirTabela() {
  if (tabelaOk) return;
  await query(`
    CREATE TABLE IF NOT EXISTS relatorios_ocorrencia (
      id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      data_documento DATE NOT NULL,
      protocolo TEXT,
      funcionario_registro TEXT,
      funcionario_nome TEXT,
      funcionario_texto TEXT,
      nome_arquivo TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      storage_uri TEXT,
      origem TEXT,
      criado_por_nome TEXT,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id)
    )`);
  try {
    await query("CREATE INDEX ASYNC idx_relatorios_user_data ON relatorios_ocorrencia (user_email, data_documento)");
  } catch (_) {
    /* índice já existe ou DSQL ainda processando o ASYNC */
  }
  tabelaOk = true;
}

function mapearLinha(r) {
  return {
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
  };
}

async function registrarMetadado(row) {
  const ins = await query(
    `INSERT INTO relatorios_ocorrencia (
       id, user_email, data_documento, protocolo, funcionario_registro, funcionario_nome,
       funcionario_texto, nome_arquivo, storage_key, storage_uri, origem, criado_por_nome, criado_em
     ) VALUES (
       $1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW())
     )
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [
      row.id,
      row.userEmail,
      row.dataDocumento,
      row.protocolo || null,
      row.funcionarioRegistro || null,
      row.funcionarioNome || null,
      row.funcionarioTexto || null,
      row.nomeArquivo,
      row.storageKey,
      row.storageUri || null,
      row.origem || null,
      row.criadoPorNome || null,
      row.criadoEm || null
    ]
  );
  if (!ins.rowCount) return;
  await registrarAudit({
    uid: row.userEmail || null,
    tabela: "relatorios_ocorrencia",
    chave: row.id,
    acao: "insert",
    depois: {
      dataDocumento: row.dataDocumento,
      protocolo: row.protocolo || null,
      nomeArquivo: row.nomeArquivo,
      storageKey: row.storageKey
    }
  });
}

async function sincronizarS3() {
  if (!relatoriosS3Configurado()) return;
  const existentes = await query("SELECT storage_key FROM relatorios_ocorrencia");
  const jaTem = new Set(existentes.rows.map((r) => r.storage_key));
  const arquivos = await listarPdfsRelatorioS3();
  const bucket = String(process.env.RELATORIOS_S3_BUCKET || "").trim();
  for (const arq of arquivos) {
    if (jaTem.has(arq.key)) continue;
    await registrarMetadado({
      id: randomUUID(),
      userEmail: arq.userEmail,
      dataDocumento: arq.dataIso,
      protocolo: "",
      funcionarioRegistro: "",
      funcionarioNome: "",
      funcionarioTexto: "",
      nomeArquivo: arq.filename,
      storageKey: arq.key,
      storageUri: bucket ? `s3://${bucket}/${arq.key}` : "",
      origem: "s3",
      criadoPorNome: "",
      criadoEm: arq.lastModified ? new Date(arq.lastModified).toISOString() : null
    });
  }
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

    const campos = camposUpload(req.body);
    const buffer = decodeBase64Pdf(req.body?.pdfBase64);

    const key = montarChaveRelatorio({
      userEmail,
      dataIso: campos.dataDocumento,
      filename: campos.filename,
      uniqueId: randomUUID().slice(0, 8)
    });

    await garantirTabela();
    const s3 = await enviarPdfRelatorioS3({
      key,
      buffer,
      metadata: {
        criadoPor: userEmail,
        protocolo: campos.protocolo,
        origem: campos.origem,
        dataDocumento: campos.dataDocumento
      }
    });

    const id = randomUUID();
    await garantirTabela();
    await registrarMetadado({
      id,
      userEmail,
      dataDocumento: campos.dataDocumento,
      protocolo: campos.protocolo,
      funcionarioRegistro: campos.funcionarioRegistro,
      funcionarioNome: campos.funcionarioNome,
      funcionarioTexto: campos.funcionarioTexto,
      nomeArquivo: campos.filename,
      storageKey: s3.key,
      storageUri: s3.s3Uri,
      origem: campos.origem,
      criadoPorNome: campos.criadoPorNome
    });

    res.json({
      ok: true,
      id,
      userEmail,
      dataDocumento: campos.dataDocumento,
      storageKey: s3.key,
      storageUri: s3.s3Uri,
      url: s3.url || ""
    });
  } catch (err) {
    console.error("relatorios/upload:", err);
    res.status(500).json({ ok: false, erro: err.message || "Falha ao salvar PDF" });
  }
});

router.post("/presign", requireFirebaseUser, async (req, res) => {
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
    const campos = camposUpload(req.body);
    const key = montarChaveRelatorio({
      userEmail,
      dataIso: campos.dataDocumento,
      filename: campos.filename,
      uniqueId: randomUUID().slice(0, 8)
    });
    const uploadUrl = await urlPresignPutRelatorioS3(key);
    res.json({
      ok: true,
      key,
      uploadUrl,
      contentType: "application/pdf",
      ...campos,
      userEmail
    });
  } catch (err) {
    console.error("relatorios/presign:", err);
    res.status(500).json({ ok: false, erro: err.message || "Falha ao assinar upload" });
  }
});

router.post("/confirmar", requireFirebaseUser, async (req, res) => {
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
    const key = String(req.body?.key || req.body?.storageKey || "").trim();
    if (!chaveDoUsuario(key, userEmail)) {
      res.status(403).json({ ok: false, erro: "Chave de armazenamento inválida" });
      return;
    }
    const existe = await relatorioExisteNoS3(key);
    if (!existe) {
      res.status(400).json({ ok: false, erro: "PDF ainda não está no S3" });
      return;
    }
    const campos = camposUpload(req.body);
    const bucket = String(process.env.RELATORIOS_S3_BUCKET || "").trim();
    const id = randomUUID();
    await garantirTabela();
    await registrarMetadado({
      id,
      userEmail,
      dataDocumento: campos.dataDocumento,
      protocolo: campos.protocolo,
      funcionarioRegistro: campos.funcionarioRegistro,
      funcionarioNome: campos.funcionarioNome,
      funcionarioTexto: campos.funcionarioTexto,
      nomeArquivo: campos.filename,
      storageKey: key,
      storageUri: bucket ? `s3://${bucket}/${key}` : "",
      origem: campos.origem,
      criadoPorNome: campos.criadoPorNome
    });
    res.json({
      ok: true,
      id,
      userEmail,
      dataDocumento: campos.dataDocumento,
      storageKey: key,
      storageUri: bucket ? `s3://${bucket}/${key}` : ""
    });
  } catch (err) {
    console.error("relatorios/confirmar:", err);
    res.status(500).json({ ok: false, erro: err.message || "Falha ao confirmar PDF" });
  }
});

router.get("/", requireFirebaseUser, async (req, res) => {
  try {
    await garantirTabela();
    try {
      await sincronizarS3();
    } catch (errSync) {
      console.warn("relatorios sync S3:", errSync.message);
    }
    const { de, ate } = intervaloDatas(req.query.de, req.query.ate, { obrigatorio: false });
    const params = [];
    let sql = `SELECT id, user_email, data_documento, protocolo, funcionario_registro, funcionario_nome,
                      funcionario_texto, nome_arquivo, storage_key, storage_uri, origem, criado_por_nome, criado_em
               FROM relatorios_ocorrencia
               WHERE 1=1`;
    if (de) {
      params.push(de);
      sql += ` AND data_documento >= $${params.length}::date`;
    }
    if (ate) {
      params.push(ate);
      sql += ` AND data_documento <= $${params.length}::date`;
    }
    sql += ` ORDER BY data_documento DESC, criado_em DESC LIMIT 400`;
    const result = await query(sql, params);
    res.json({
      ok: true,
      total: result.rows.length,
      dados: result.rows.map(mapearLinha)
    });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ ok: false, erro: err.message, codigo: err.codigo });
      return;
    }
    console.error("relatorios GET:", err);
    try {
      const arquivos = await listarPdfsRelatorioS3();
      const { de, ate } = intervaloDatas(req.query.de, req.query.ate, { obrigatorio: false });
      const dados = arquivos
        .filter((a) => (!de || a.dataIso >= de) && (!ate || a.dataIso <= ate))
        .sort((a, b) => String(b.dataIso).localeCompare(String(a.dataIso)))
        .slice(0, 400)
        .map((a) => ({
          id: a.key,
          userEmail: a.userEmail,
          dataDocumento: a.dataIso,
          protocolo: "",
          funcionarioRegistro: "",
          funcionarioNome: "",
          funcionarioTexto: "",
          nomeArquivo: a.filename,
          storageKey: a.key,
          storageUri: "",
          origem: "s3",
          criadoPorNome: a.userEmail,
          criadoEm: a.lastModified
        }));
      res.json({ ok: true, total: dados.length, dados, origem: "s3" });
    } catch (err2) {
      res.status(500).json({ ok: false, erro: err.message || err2.message });
    }
  }
});

router.get("/:id/download", requireFirebaseUser, async (req, res) => {
  try {
    if (!relatoriosS3Configurado()) {
      res.status(503).json({ ok: false, erro: "Armazenamento S3 de relatórios não configurado" });
      return;
    }
    const id = String(req.params.id || "").trim();
    if (!id) {
      res.status(400).json({ ok: false, erro: "ID inválido" });
      return;
    }
    let row = null;
    try {
      await garantirTabela();
      const result = await query(
        `SELECT id, user_email, nome_arquivo, storage_key
         FROM relatorios_ocorrencia
         WHERE id = $1 OR storage_key = $1
         LIMIT 1`,
        [id]
      );
      row = result.rows[0] || null;
    } catch (_) {
      row = null;
    }
    const storageKey = row?.storage_key || (id.startsWith("relatorios/") ? id : "");
    if (!storageKey) {
      res.status(404).json({ ok: false, erro: "Relatório não encontrado" });
      return;
    }
    const url = await urlAssinadaRelatorioS3(storageKey, 60 * 30);
    res.json({
      ok: true,
      id: row?.id || id,
      nomeArquivo: row?.nome_arquivo || "relatorio.pdf",
      url
    });
  } catch (err) {
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
