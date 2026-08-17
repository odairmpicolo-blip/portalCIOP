import { Router } from "express";
import { randomUUID } from "node:crypto";
import { query } from "../db.js";
import { requireFirebaseUser } from "../middleware/auth.js";
import { enviarPdfRelatorioS3, listarPdfsRelatorioS3, montarChaveRelatorio, relatoriosS3Configurado, urlAssinadaRelatorioS3 } from "../lib/relatorios-s3.js";

const router = Router();
const MAX_PDF_BYTES = 12 * 1024 * 1024;

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function dataIsoValida(valor) {
  const s = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
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
  await query(
    `INSERT INTO relatorios_ocorrencia (
       id, user_email, data_documento, protocolo, funcionario_registro, funcionario_nome,
       funcionario_texto, nome_arquivo, storage_key, storage_uri, origem, criado_por_nome, criado_em
     ) VALUES (
       $1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW())
     )
     ON CONFLICT (id) DO NOTHING`,
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

    await garantirTabela();
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
    await garantirTabela();
    await registrarMetadado({
      id,
      userEmail,
      dataDocumento,
      protocolo,
      funcionarioRegistro,
      funcionarioNome,
      funcionarioTexto,
      nomeArquivo: filename,
      storageKey: s3.key,
      storageUri: s3.s3Uri,
      origem,
      criadoPorNome
    });

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
    await garantirTabela();
    try {
      await sincronizarS3();
    } catch (errSync) {
      console.warn("relatorios sync S3:", errSync.message);
    }
    const de = String(req.query.de || "").slice(0, 10);
    const ate = String(req.query.ate || "").slice(0, 10);
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
    console.error("relatorios GET:", err);
    try {
      const arquivos = await listarPdfsRelatorioS3();
      const de = String(req.query.de || "").slice(0, 10);
      const ate = String(req.query.ate || "").slice(0, 10);
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
