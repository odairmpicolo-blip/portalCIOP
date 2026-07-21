import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

let client = null;

function getClient() {
  if (!client) {
    client = new S3Client({ region: config.relatoriosS3Region || config.dsqlRegion || "sa-east-1" });
  }
  return client;
}

export function relatoriosS3Configurado() {
  return Boolean(String(config.relatoriosS3Bucket || "").trim());
}

export function montarChaveRelatorio({ userEmail, dataIso, filename }) {
  const email = String(userEmail || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.@_+-]+/g, "-");
  const data = String(dataIso || "").trim().slice(0, 10);
  const nome = String(filename || "relatorio.pdf")
    .replace(/[\\/#?[\]]+/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 180);
  const final = /\.pdf$/i.test(nome) ? nome : `${nome}.pdf`;
  return `relatorios/${email}/${data}/${final}`;
}

export async function enviarPdfRelatorioS3({ key, buffer, contentType = "application/pdf", metadata = {} }) {
  const bucket = String(config.relatoriosS3Bucket || "").trim();
  if (!bucket) throw new Error("RELATORIOS_S3_BUCKET não configurado");
  if (!key) throw new Error("Chave S3 inválida");
  if (!buffer?.length) throw new Error("PDF vazio");

  const meta = {};
  for (const [k, v] of Object.entries(metadata || {})) {
    const val = String(v ?? "").trim();
    if (!val) continue;
    meta[String(k).slice(0, 64)] = val.slice(0, 256);
  }

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: meta
    })
  );

  let url = "";
  try {
    url = await getSignedUrl(
      getClient(),
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 60 * 60 * 24 * 7 }
    );
  } catch (_) {
    /* URL assinada é opcional */
  }

  return {
    bucket,
    key,
    url,
    s3Uri: `s3://${bucket}/${key}`
  };
}

export async function urlAssinadaRelatorioS3(key, expiresIn = 60 * 30) {
  const bucket = String(config.relatoriosS3Bucket || "").trim();
  if (!bucket) throw new Error("RELATORIOS_S3_BUCKET não configurado");
  if (!key) throw new Error("Chave S3 inválida");
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}
