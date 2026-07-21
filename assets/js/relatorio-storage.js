/**
 * Upload de PDF de relatório de ocorrência para AWS (S3 + DSQL).
 * Pasta: relatorios/{usuario}/{data}/{arquivo.pdf}
 */
import { awsApiEnabled, awsFetch, firebaseIdToken, initPortalAwsRuntime } from "./portal-aws-config.js";

function pdfParaBase64(pdf) {
  if (!pdf || typeof pdf.output !== "function") throw new Error("PDF inválido");
  return String(pdf.output("datauristring") || "").replace(/^data:application\/pdf;base64,/i, "");
}

/**
 * @param {{ pdf: object, filename: string, meta?: object }} args
 */
export async function salvarPdfRelatorioOcorrencia({ pdf, filename, meta = {} }) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) {
    throw new Error("API AWS não configurada (PORTAL_AWS_API_URL)");
  }

  const token = await firebaseIdToken();
  const body = {
    filename: filename || "relatorio.pdf",
    pdfBase64: pdfParaBase64(pdf),
    dataDocumento: meta.data || meta.dataDocumento || "",
    protocolo: meta.protocolo || "",
    funcionarioRegistro: meta.funcionarioRegistro || "",
    funcionarioNome: meta.funcionarioNome || "",
    funcionarioTexto: meta.funcionarioTexto || "",
    origem: meta.origem || "pdf",
    criadoPorNome: meta.criadoPorNome || meta.userNome || ""
  };

  const result = await awsFetch("/relatorios/upload", {
    method: "POST",
    token,
    body
  });

  if (!result?.ok) {
    throw new Error(result?.erro || "Falha ao salvar PDF na AWS");
  }
  return result;
}
