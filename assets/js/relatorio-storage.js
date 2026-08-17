/**
 * Upload de PDF de relatório de ocorrência para AWS (S3 + DSQL).
 * Pasta: relatorios/{usuario}/{data}/{arquivo.pdf}
 *
 * O PDF vai direto ao S3 (URL pré-assinada). Mandar o arquivo em JSON/base64
 * pela Lambda estoura o limite de 6 MB e o relatório some da listagem.
 */
import { awsApiEnabled, awsFetch, firebaseIdToken, initPortalAwsRuntime } from "./portal-aws-config.js";

function pdfParaBase64(pdf) {
  if (!pdf || typeof pdf.output !== "function") throw new Error("PDF inválido");
  return String(pdf.output("datauristring") || "").replace(/^data:application\/pdf;base64,/i, "");
}

function pdfParaBlob(pdf) {
  if (!pdf || typeof pdf.output !== "function") throw new Error("PDF inválido");
  const blob = pdf.output("blob");
  if (!blob) throw new Error("Não foi possível gerar o blob do PDF");
  return blob;
}

function metaBody(filename, meta = {}) {
  return {
    filename: filename || "relatorio.pdf",
    dataDocumento: meta.data || meta.dataDocumento || "",
    protocolo: meta.protocolo || "",
    funcionarioRegistro: meta.funcionarioRegistro || "",
    funcionarioNome: meta.funcionarioNome || "",
    funcionarioTexto: meta.funcionarioTexto || "",
    origem: meta.origem || "pdf",
    criadoPorNome: meta.criadoPorNome || meta.userNome || ""
  };
}

async function tokenAws() {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) throw new Error("API AWS não configurada (PORTAL_AWS_API_URL)");
  return firebaseIdToken();
}

async function enviarPdfDiretoS3(pdf, filename, meta, token) {
  const campos = metaBody(filename, meta);
  const presign = await awsFetch("/relatorios/presign", {
    method: "POST",
    token,
    body: campos
  });
  if (!presign?.ok || !presign.uploadUrl || !presign.key) {
    throw new Error(presign?.erro || "Falha ao preparar upload no S3");
  }

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": presign.contentType || "application/pdf" },
    body: pdfParaBlob(pdf)
  });
  if (!put.ok) {
    const detalhe = await put.text().catch(() => "");
    throw new Error(`Falha no envio ao S3 (HTTP ${put.status})${detalhe ? ": " + detalhe.slice(0, 180) : ""}`);
  }

  const confirmado = await awsFetch("/relatorios/confirmar", {
    method: "POST",
    token,
    body: { ...campos, key: presign.key }
  });
  if (!confirmado?.ok) {
    throw new Error(confirmado?.erro || "PDF foi ao S3, mas a confirmação falhou");
  }
  return confirmado;
}

async function enviarPdfViaLambda(pdf, filename, meta, token) {
  const result = await awsFetch("/relatorios/upload", {
    method: "POST",
    token,
    body: {
      ...metaBody(filename, meta),
      pdfBase64: pdfParaBase64(pdf)
    }
  });
  if (!result?.ok) {
    throw new Error(result?.erro || "Falha ao salvar PDF na AWS");
  }
  return result;
}

/**
 * @param {{ pdf: object, filename: string, meta?: object }} args
 */
export async function salvarPdfRelatorioOcorrencia({ pdf, filename, meta = {} }) {
  const token = await tokenAws();
  try {
    return await enviarPdfDiretoS3(pdf, filename, meta, token);
  } catch (errS3) {
    console.warn("Upload direto ao S3 falhou, tentando via API:", errS3);
    try {
      return await enviarPdfViaLambda(pdf, filename, meta, token);
    } catch (errApi) {
      throw new Error(errS3?.message || errApi?.message || "Falha ao salvar PDF na AWS");
    }
  }
}

export async function listarRelatoriosOcorrencia({ de = "", ate = "" } = {}) {
  const token = await tokenAws();
  const qs = new URLSearchParams();
  if (de) qs.set("de", de);
  if (ate) qs.set("ate", ate);
  const path = qs.toString() ? `/relatorios?${qs}` : "/relatorios";
  const result = await awsFetch(path, { method: "GET", token });
  if (!result?.ok) throw new Error(result?.erro || "Falha ao listar relatórios");
  return result;
}

export async function urlDownloadRelatorioOcorrencia(id) {
  const token = await tokenAws();
  const result = await awsFetch(`/relatorios/${encodeURIComponent(id)}/download`, {
    method: "GET",
    token
  });
  if (!result?.ok || !result.url) {
    throw new Error(result?.erro || "Falha ao obter link do PDF");
  }
  return result;
}
