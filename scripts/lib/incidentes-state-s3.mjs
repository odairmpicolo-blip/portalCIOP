/**
 * Cache incremental de incidentes-tcgl.json em S3 (Lambda / EC2).
 */
import fs from "node:fs";
import path from "node:path";

function bucketConfig() {
  const bucket = (process.env.INCIDENTES_STATE_S3_BUCKET || "").trim();
  const key = (process.env.INCIDENTES_STATE_S3_KEY || "incidentes-tcgl.json").trim();
  const region = process.env.INCIDENTES_STATE_S3_REGION || process.env.AWS_REGION || "sa-east-1";
  if (!bucket) return null;
  return { bucket, key, region };
}

export async function baixarEstadoIncidentesS3(destFile) {
  const cfg = bucketConfig();
  if (!cfg) return false;
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: cfg.region });
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: cfg.key }));
    const body = await res.Body?.transformToByteArray();
    if (!body?.length) return false;
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, Buffer.from(body));
    console.log(`[s3] Estado baixado: s3://${cfg.bucket}/${cfg.key}`);
    return true;
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      console.log(`[s3] Sem cache anterior em s3://${cfg.bucket}/${cfg.key}`);
      return false;
    }
    throw err;
  }
}

export async function enviarEstadoIncidentesS3(srcFile) {
  const cfg = bucketConfig();
  if (!cfg) return false;
  if (!fs.existsSync(srcFile)) {
    console.warn(`[s3] Arquivo local não encontrado: ${srcFile}`);
    return false;
  }
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: cfg.region });
  const body = fs.readFileSync(srcFile);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: cfg.key,
      Body: body,
      ContentType: "application/json"
    })
  );
  console.log(`[s3] Estado enviado: s3://${cfg.bucket}/${cfg.key} (${body.length} bytes)`);
  return true;
}
