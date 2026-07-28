import { Router } from "express";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";
import { requireFirebaseUser } from "../middleware/auth.js";

const router = Router();

let client = null;
function getClient() {
  if (!client) {
    client = new S3Client({ region: config.performanceS3Region });
  }
  return client;
}

/**
 * Indicadores oficiais de performance (OTP/CAD).
 *
 * O dado é coletado por scripts/sync-performance.mjs rodando DENTRO da rede do CIOP
 * (a API OTP fica num IP privado, inalcançável daqui) e depositado no S3. Esta rota
 * só lê e devolve — nunca busca na origem.
 */
router.get("/", requireFirebaseUser, async (_req, res) => {
  const bucket = String(config.performanceS3Bucket || "").trim();
  if (!bucket) {
    res.status(503).json({ ok: false, erro: "PERFORMANCE_S3_BUCKET não configurado" });
    return;
  }

  try {
    const out = await getClient().send(
      new GetObjectCommand({ Bucket: bucket, Key: config.performanceS3Key })
    );
    const texto = await out.Body?.transformToString();
    if (!texto) {
      res.status(404).json({ ok: false, erro: "performance.json vazio" });
      return;
    }

    // O agente pode estar parado; devolver a idade deixa o cliente decidir se ainda
    // vale mostrar o número como "ao vivo" em vez de assumir que está fresco.
    const payload = JSON.parse(texto);
    const atualizadoEm = payload?.atualizadoEm ? new Date(payload.atualizadoEm) : null;
    const idadeSegundos = atualizadoEm && !Number.isNaN(atualizadoEm.getTime())
      ? Math.max(0, Math.round((Date.now() - atualizadoEm.getTime()) / 1000))
      : null;

    // Mesmo formato dos demais snapshots (/terminais/atual etc.), para o portal
    // reaproveitar carregarSnapshotAws() sem tratamento especial.
    res.set("Cache-Control", "no-store");
    res.json({
      ok: true,
      payload,
      atualizadoEm: payload?.atualizadoEm || null,
      idadeSegundos,
      origem: "aws"
    });
  } catch (err) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ ok: false, erro: "performance.json ainda não publicado" });
      return;
    }
    res.status(500).json({ ok: false, erro: err.message });
  }
});

export default router;
