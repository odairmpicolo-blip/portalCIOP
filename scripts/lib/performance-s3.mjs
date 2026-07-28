/**
 * Publicação do performance.json em S3.
 *
 * Mesmo padrão de scripts/lib/incidentes-state-s3.mjs: o agente roda DENTRO da rede
 * do CIOP (a API OTP fica num IP privado, inalcançável da AWS) e só faz conexão de
 * saída para o S3. A partir daí quem serve o dado é a Lambda portal-api.
 */
import fs from "node:fs";

export function performanceS3Config() {
  const bucket = (process.env.PERFORMANCE_S3_BUCKET || "").trim();
  const key = (process.env.PERFORMANCE_S3_KEY || "performance.json").trim();
  const region = process.env.PERFORMANCE_S3_REGION || process.env.AWS_REGION || "sa-east-1";
  if (!bucket) return null;
  return { bucket, key, region };
}

export async function enviarPerformanceS3(srcFile) {
  const cfg = performanceS3Config();
  if (!cfg) {
    console.log("[s3] PERFORMANCE_S3_BUCKET não configurado — upload ignorado.");
    return false;
  }
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
      ContentType: "application/json",
      // O dado vira obsoleto em minutos; evita CDN/proxy servindo número velho
      // como se fosse ao vivo.
      CacheControl: "no-cache, max-age=0"
    })
  );
  console.log(`[s3] performance.json enviado: s3://${cfg.bucket}/${cfg.key} (${body.length} bytes)`);
  return true;
}
