import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export async function putJsonS3(bucket, key, obj) {
  const c = new S3Client({ region: process.env.AWS_REGION || "sa-east-1" });
  await c.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: Buffer.from(JSON.stringify(obj)),
    ContentType: "application/json"
  }));
  return `s3://${bucket}/${key}`;
}
