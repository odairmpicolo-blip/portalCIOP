import { SecretsManagerClient, GetSecretValueCommand, PutSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION || "sa-east-1";
const SECRET_NAME = process.env.FLEETBUS_SECRET_NAME || "portal-ciop/fleetbus-sync";
const STATE_BUCKET = process.env.FLEETBUS_STATE_S3_BUCKET;
const CLIENT_ID = process.env.FLEETBUS_CLIENT_ID || "cd-avm4-spa";
const BASE_URL = "https://fleetbus.app";
const CONSUME_WINDOW_MS = Number(process.env.FLEETBUS_CONSUME_WINDOW_MS || 6000);

// Modelo "1 veículo por vez", igual à própria tela on-demand do FleetBus:
// o frontend escolhe um veículo e faz polling do endpoint /live?vehicleId=X
// a cada 20-30s. A Lambda só abre 1 conexão SSE por chamada, pelo tempo de
// CONSUME_WINDOW_MS, nunca em segundo plano — sem EventBridge, sem varrer a
// frota inteira.

// Mapa "signal key numérico" -> campo. Validado via /api/v1/aod/numericmetadata.
// 504/505 (lat/lng) confirmados ao vivo; os demais confirmados no catálogo mas
// ainda não observados em um evento real de veículo em movimento — se algum
// campo ficar sempre nulo em produção, confira o CloudWatch e ajuste aqui.
const SIGNALS = {
  504: "lat",
  505: "lng",
  20: "speedKmh",
  4182: "accelMs2",
  19: "odometerKm",
  18: "fuelTotalL",
  25: "fuelLevelPct",
  72: "coolantTempC"
};

const secretsClient = new SecretsManagerClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });

async function getSecret() {
  const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_NAME }));
  return JSON.parse(res.SecretString);
}

async function putSecret(obj) {
  await secretsClient.send(new PutSecretValueCommand({ SecretId: SECRET_NAME, SecretString: JSON.stringify(obj) }));
}

// O refresh_token do FleetBus roda em rotação: cada uso invalida o anterior e
// devolve um novo. Por isso salvamos de volta no Secrets Manager assim que
// recebemos a resposta, antes de qualquer outra chamada.
async function refreshAccessToken() {
  const secret = await getSecret();
  if (!secret.refresh_token) {
    throw new Error("Secret sem refresh_token. Rode scripts/deploy-fleetbus-lambda.sh após configurar fleetbus.env.");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: secret.refresh_token
  });
  const res = await fetch(BASE_URL + "/oidc/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    throw new Error("Falha ao renovar token FleetBus: HTTP " + res.status);
  }
  const json = await res.json();
  if (json.refresh_token && json.refresh_token !== secret.refresh_token) {
    await putSecret({ ...secret, refresh_token: json.refresh_token });
  }
  if (!json.access_token) {
    throw new Error("Resposta de refresh sem access_token.");
  }
  return json.access_token;
}

async function fetchVehicles(accessToken) {
  const res = await fetch(BASE_URL + "/api/v1/i/vehicles?onlyVehiclesInService=true", {
    headers: { Authorization: "Bearer " + accessToken },
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Falha ao listar veículos: HTTP " + res.status);
  const arr = await res.json();
  if (!Array.isArray(arr)) return [];
  return arr.map((v) => ({
    vehicleId: v.vehicleId,
    vehicleNumber: v.vehicleNumber,
    manufacturer: v.manufacturer,
    model: v.model,
    locationName: v.locationName
  }));
}

// Consome o stream SSE de um único veículo por até windowMs, acumulando os
// sinais que chegarem (podem vir espalhados em vários eventos, um sinal por vez).
async function consumeVehicleSignals(accessToken, vehicleId, windowMs) {
  const collected = {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), windowMs);
  try {
    const res = await fetch(
      BASE_URL + "/api/v1/fluxlivedata/startConsume?vehicleId=" + encodeURIComponent(vehicleId),
      { headers: { Authorization: "Bearer " + accessToken }, signal: controller.signal }
    );
    if (!res.ok || !res.body) return collected;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx = buffer.indexOf("\n\n");
      if (idx === -1) idx = buffer.indexOf("\r\r");
      while (idx !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const dataLine = raw.split(/\r|\n/).find((line) => line.startsWith("data:"));
        if (dataLine) {
          try {
            const payload = JSON.parse(dataLine.slice(5).trim());
            const kv = Array.isArray(payload.keyValue) ? payload.keyValue : [];
            for (const entry of kv) {
              const field = SIGNALS[entry.Key];
              if (field != null && entry.Value != null) {
                collected[field] = entry.Value;
              }
            }
          } catch {
            // linha incompleta/inválida: ignora e segue
          }
        }
        idx = buffer.indexOf("\n\n");
        if (idx === -1) idx = buffer.indexOf("\r\r");
      }
    }
  } catch (err) {
    if (err?.name !== "AbortError") {
      console.warn("Falha ao consumir veículo " + vehicleId + ":", err?.message || err);
    }
  } finally {
    clearTimeout(timer);
  }
  return collected;
}

function stateKeyFor(vehicleId) {
  return "vehicles/" + encodeURIComponent(vehicleId) + ".json";
}

async function loadVehicleState(vehicleId) {
  try {
    const res = await s3Client.send(new GetObjectCommand({ Bucket: STATE_BUCKET, Key: stateKeyFor(vehicleId) }));
    const text = await res.Body.transformToString();
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function saveVehicleState(vehicleId, state) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: STATE_BUCKET,
      Key: stateKeyFor(vehicleId),
      Body: JSON.stringify(state),
      ContentType: "application/json"
    })
  );
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(body)
  };
}

async function handleVehiclesRoute() {
  const accessToken = await refreshAccessToken();
  const vehicles = await fetchVehicles(accessToken);
  return jsonResponse(200, { vehicles });
}

async function handleLiveRoute(vehicleId) {
  if (!vehicleId) return jsonResponse(400, { error: "informe ?vehicleId=" });
  const accessToken = await refreshAccessToken();
  const now = new Date().toISOString();
  const [collected, prev] = await Promise.all([
    consumeVehicleSignals(accessToken, vehicleId, CONSUME_WINDOW_MS),
    STATE_BUCKET ? loadVehicleState(vehicleId) : Promise.resolve({})
  ]);
  const merged = {
    ...prev,
    vehicleId,
    ...collected,
    lastSeenAt: Object.keys(collected).length ? now : prev.lastSeenAt || null,
    updatedAt: now
  };
  if (STATE_BUCKET) await saveVehicleState(vehicleId, merged);
  return jsonResponse(200, merged);
}

export const handler = async (event) => {
  try {
    const path = event?.rawPath || event?.path || "";
    const qs = event?.queryStringParameters || {};
    const method = event?.requestContext?.http?.method || event?.httpMethod || "GET";

    if (method === "OPTIONS") {
      return { statusCode: 204, headers: CORS_HEADERS, body: "" };
    }
    if (path.endsWith("/vehicles")) {
      return await handleVehiclesRoute();
    }
    if (path.endsWith("/live")) {
      return await handleLiveRoute(qs.vehicleId);
    }
    // Invocação manual/probe: {"mode":"vehicles"} ou {"mode":"live","vehicleId":"..."}
    if (event?.mode === "vehicles") {
      return await handleVehiclesRoute();
    }
    if (event?.mode === "live") {
      return await handleLiveRoute(event.vehicleId);
    }
    return jsonResponse(404, { error: "rota desconhecida" });
  } catch (err) {
    console.error("Erro FleetBus:", err);
    return jsonResponse(500, { error: String(err?.message || err) });
  }
};
