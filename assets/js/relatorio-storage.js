/**
 * Upload de PDF de relatório de ocorrência para AWS (S3 + DSQL).
 * Pasta: relatorios/{usuario}/{data}/{arquivo.pdf}
 */
import { awsApiEnabled, awsFetch, firebaseIdToken, initPortalAwsRuntime } from "./portal-aws-config.js";

function pdfParaBase64(pdf) {
  if (!pdf || typeof pdf.output !== "function") throw new Error("PDF inválido");
  return String(pdf.output("datauristring") || "").replace(/^data:application\/pdf;base64,/i, "");
}

async function tokenAws() {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) throw new Error("API AWS não configurada (PORTAL_AWS_API_URL)");
  return firebaseIdToken();
}

/**
 * @param {{ pdf: object, filename: string, meta?: object }} args
 */
export async function salvarPdfRelatorioOcorrencia({ pdf, filename, meta = {} }) {
  const token = await tokenAws();
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
