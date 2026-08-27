import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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

export function montarChaveRelatorio({ userEmail, dataIso, filename, uniqueId = "" }) {
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
  const id = String(uniqueId || "").replace(/[^a-zA-Z0-9-]+/g, "").slice(0, 12);
  const prefixo = id ? `${id}-` : "";
  return `relatorios/${email}/${data}/${prefixo}${final}`;
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
    meta[String(k).slice(0, 64)] = val.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").slice(0, 256); // metadado do S3 precisa ser US-ASCII: entra no calculo da assinatura SigV4
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

export async function urlPresignPutS3(key, contentType = "application/octet-stream", expiresIn = 60 * 15) {
  const bucket = String(config.relatoriosS3Bucket || "").trim();
  if (!bucket) throw new Error("RELATORIOS_S3_BUCKET não configurado");
  if (!key) throw new Error("Chave S3 inválida");
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    }),
    { expiresIn }
  );
}

export async function urlPresignPutRelatorioS3(key, expiresIn = 60 * 15) {
  return urlPresignPutS3(key, "application/pdf", expiresIn);
}

function emailChaveS3(userEmail) {
  return String(userEmail || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.@_+-]+/g, "-");
}

export function montarChaveEvidencia({ userEmail, autoId, slot }) {
  const email = emailChaveS3(userEmail);
  const id = String(autoId || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 80);
  const nome = String(slot || "arquivo")
    .replace(/[^a-zA-Z0-9_-]+/g, "")
    .slice(0, 80);
  if (!email || !id || !nome) throw new Error("Chave de evidência inválida");
  return `evidencias/${email}/${id}/${nome}.jpg`;
}

export function chaveEvidenciaDoUsuario(key, userEmail) {
  const prefixo = `evidencias/${emailChaveS3(userEmail)}/`;
  return String(key || "").startsWith(prefixo);
}

export async function apagarPrefixoS3(prefix) {
  const bucket = String(config.relatoriosS3Bucket || "").trim();
  if (!bucket || !prefix) return;
  let token;
  do {
    const res = await getClient().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token
      })
    );
    const objetos = (res.Contents || []).map((obj) => ({ Key: obj.Key })).filter((o) => o.Key);
    if (objetos.length) {
      await getClient().send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objetos, Quiet: true }
        })
      );
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
}

export async function relatorioExisteNoS3(key) {
  const bucket = String(config.relatoriosS3Bucket || "").trim();
  if (!bucket || !key) return false;
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === "NotFound") return false;
    throw err;
  }
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

export function parseChaveRelatorio(key) {
  const m = String(key || "").match(/^relatorios\/([^/]+)\/(\d{4}-\d{2}-\d{2})\/(.+)$/);
  if (!m) return null;
  return { userEmail: decodeURIComponent(m[1]), dataIso: m[2], filename: m[3], key };
}

export async function listarPdfsRelatorioS3() {
  const bucket = String(config.relatoriosS3Bucket || "").trim();
  if (!bucket) return [];
  const itens = [];
  let token;
  do {
    const res = await getClient().send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "relatorios/",
      ContinuationToken: token
    }));
    for (const obj of res.Contents || []) {
      const parsed = parseChaveRelatorio(obj.Key);
      if (!parsed) continue;
      itens.push({
        ...parsed,
        size: obj.Size || 0,
        lastModified: obj.LastModified || null
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return itens;
}
