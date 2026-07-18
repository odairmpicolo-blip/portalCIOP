import https from "node:https";

const MOBILIBUS = "https://mobilibus.com/api";
/** BusTime TCGL entrega cadeia TLS incompleta; Node rejeita sem rejectUnauthorized. */
const MOV1_HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });
const BUSTIME_BASE = (process.env.BUSTIME_BASE_URL || "https://csr.mov1.com.br/bustime/api/v3").replace(/\/+$/, "");
const BUSTIME_KEY = process.env.BUSTIME_API_KEY || "";
const BUSTIME_REFERER = process.env.BUSTIME_REFERER || "https://csr.mov1.com.br/map";

const FLEETBUS_ORIGIN = (process.env.FLEETBUS_ORIGIN || "https://fleetbus.app").replace(/\/+$/, "");
const FLEETBUS_TOKEN = process.env.FLEETBUS_ACCESS_TOKEN || "";
const FLEETBUS_REFRESH = process.env.FLEETBUS_REFRESH_TOKEN || "";
const FLEETBUS_TOKEN_URL = process.env.FLEETBUS_TOKEN_URL || `${FLEETBUS_ORIGIN}/oidc/oauth2/token`;
const FLEETBUS_CLIENT_ID = process.env.FLEETBUS_CLIENT_ID || "cd-avm4-spa";

/** Cache em memória do access token (refresh sob demanda). */
let fleetTokenCache = {
  access: FLEETBUS_TOKEN,
  refresh: FLEETBUS_REFRESH,
  exp: 0
};

function corsHeaders(contentType = "application/json") {
  return {
    "Content-Type": contentType,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store"
  };
}

function resolveBus2Path(event) {
  const rawPath = event.rawPath || event.path || "";
  if (rawPath.startsWith("/bus2/")) return rawPath.slice("/bus2/".length);
  if (rawPath === "/bus2") return "";
  if (event.pathParameters?.proxy) return event.pathParameters.proxy;
  return rawPath.replace(/^\//, "");
}

function resolveMov1Action(event) {
  const rawPath = event.rawPath || event.path || "";
  const trimmed = rawPath.replace(/^\/mov1\/?/, "");
  const action = trimmed.split("/").filter(Boolean)[0];
  return action || "getvehicles";
}

async function proxyBus2(event) {
  const apiPath = resolveBus2Path(event);
  const qs = event.rawQueryString ? `?${event.rawQueryString}` : "";
  const url = `${MOBILIBUS}/${apiPath}${qs}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(24000)
  });
  const body = await res.text();
  return {
    statusCode: res.status,
    headers: corsHeaders(res.headers.get("content-type") || "application/json"),
    body
  };
}

async function httpsGetText(url, headers, timeoutMs = 24000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, agent: MOV1_HTTPS_AGENT }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve({ statusCode: res.statusCode || 502, body }));
    });
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
  });
}

async function proxyMov1(event) {
  const action = resolveMov1Action(event);
  const params = new URLSearchParams(event.rawQueryString || "");
  params.set("requestType", action);
  if (BUSTIME_KEY) params.set("key", BUSTIME_KEY);
  params.set("format", "json");

  const url = `${BUSTIME_BASE}/${action}?${params.toString()}`;
  const res = await httpsGetText(url, {
    Accept: "application/json",
    Referer: BUSTIME_REFERER,
    Origin: new URL(BUSTIME_REFERER).origin,
    "User-Agent": "Mozilla/5.0 (compatible; PortalCIOP/1.0)"
  });
  return {
    statusCode: res.statusCode,
    headers: corsHeaders("application/json"),
    body: res.body
  };
}

async function ensureFleetbusToken() {
  if (fleetTokenCache.access && fleetTokenCache.exp > Date.now() + 60_000) {
    return fleetTokenCache.access;
  }
  if (fleetTokenCache.access && !fleetTokenCache.refresh) {
    return fleetTokenCache.access;
  }
  if (!fleetTokenCache.refresh) {
    if (fleetTokenCache.access) return fleetTokenCache.access;
    throw new Error("FLEETBUS_ACCESS_TOKEN não configurado na Lambda.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: fleetTokenCache.refresh,
    client_id: FLEETBUS_CLIENT_ID
  });
  const res = await fetch(FLEETBUS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(20000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    if (fleetTokenCache.access) return fleetTokenCache.access;
    throw new Error(data.error_description || data.error || "Falha ao renovar token FleetBus.");
  }
  fleetTokenCache.access = data.access_token;
  if (data.refresh_token) fleetTokenCache.refresh = data.refresh_token;
  fleetTokenCache.exp = Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000;
  return fleetTokenCache.access;
}

async function fleetbusFetch(pathAndQuery, token) {
  const url = `${FLEETBUS_ORIGIN}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      Referer: `${FLEETBUS_ORIGIN}/on-demand/real-time`,
      Origin: FLEETBUS_ORIGIN,
      "User-Agent": "Mozilla/5.0 (compatible; PortalCIOP/1.0)"
    },
    signal: AbortSignal.timeout(24000)
  });
  const text = await res.text();
  return { status: res.status, text, contentType: res.headers.get("content-type") || "application/json" };
}

function convertFleetSignal(id, value) {
  const sid = String(id);
  let v = Number(value);
  if (!Number.isFinite(v)) return null;
  // Conversões do próprio FleetBus (convertSignalDataValue)
  if (sid === "19" || sid === "4669") v = v / 1000; // metros → km
  if (sid === "5722") v = v / 832; // gramas → litros (aprox.)
  return v;
}

/** IDs usados pelo On-Demand + equivalentes do enum Clever/AVM. */
const FLEET_SIGNAL_ALIASES = {
  speed: ["6054", "20", "100", "99", "168"],
  rpm: ["4670", "11", "50", "140"],
  odometer: ["4669", "4563", "19", "66", "67", "122", "244", "68"],
  fuel: ["4660", "25", "63", "64", "9", "10"],
  temp: ["166", "38", "47", "48"]
};

function normalizeFleetSignals(signals) {
  const out = { ...(signals || {}) };
  for (const [name, ids] of Object.entries(FLEET_SIGNAL_ALIASES)) {
    for (const id of ids) {
      if (out[id] != null && Number.isFinite(Number(out[id]))) {
        out[name] = Number(out[id]);
        break;
      }
    }
  }
  // Fallback combustível: alguns veículos publicam % em objectIds fora do mapa oficial.
  if (out.fuel == null) {
    for (const [id, val] of Object.entries(signals || {})) {
      const n = Number(val);
      if (!Number.isFinite(n)) continue;
      if ((id === "33" || id === "81") && n >= 0 && n <= 100) {
        out.fuel = n;
        out[id] = n;
        break;
      }
    }
  }
  return out;
}

/** Cache em memória entre invocações warm: acumula sinais por veículo. */
const fleetLiveCache = new Map();

function mergeFleetLiveCache(vehicleId, signals, gps, faults) {
  const prev = fleetLiveCache.get(String(vehicleId)) || { signals: {}, gps: null, faults: [], updatedAt: 0 };
  const mergedSignals = { ...prev.signals, ...(signals || {}) };
  const mergedGps = gps || prev.gps;
  const faultMap = new Map();
  for (const f of [...(prev.faults || []), ...(faults || [])]) {
    const key = `${f.objectId || ""}|${f.description || ""}`;
    faultMap.set(key, f);
  }
  const entry = {
    signals: mergedSignals,
    gps: mergedGps,
    faults: Array.from(faultMap.values()).slice(-40),
    updatedAt: Date.now()
  };
  fleetLiveCache.set(String(vehicleId), entry);
  return entry;
}

function hasCoreFleetSignals(signals) {
  const n = normalizeFleetSignals(signals);
  return n.speed != null || n.rpm != null || n.odometer != null || n.fuel != null || n.temp != null;
}

function ingestFleetLiveBlock(block, signals, state) {
  // FleetBus usa \r (sem \n) como separador de linhas no SSE.
  const lines = String(block || "").split(/\r\n|\n|\r/).filter((l) => l.length > 0);
  let eventName = "message";
  let dataLine = "";
  for (const line of lines) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) dataLine += line.slice(5).trim();
  }
  if (!dataLine || dataLine === "-1") return;
  try {
    if (eventName === "faultEvent") {
      const d = JSON.parse(dataLine);
      state.events += 1;
      if (!Array.isArray(state.faults)) state.faults = [];
      state.faults.push({
        objectId: d.ObjectId ?? d.objectId ?? null,
        description: d.CommonDescription ?? d.commonDescription ?? d.description ?? "Falha",
        severity: d.Severity ?? d.severity ?? d.Criticity ?? d.criticity ?? null,
        dateTimeUTC: d.DateTimeUTC ?? d.dateTimeUTC ?? null,
        duration: d.Duration ?? d.duration ?? 0
      });
      return;
    }
    // Aceita liveDataEvent; também JSON sem event name (alguns proxies normalizam SSE).
    if (eventName && eventName !== "message" && eventName !== "liveDataEvent") return;
    const d = JSON.parse(dataLine);
    state.events += 1;
    const id = String(d.id ?? "");
    if (!id) return;
    if (id === "5555" && Array.isArray(d.keyValue)) {
      state.gps = {};
      for (const kv of d.keyValue) {
        const key = kv?.Key ?? kv?.key;
        if (key != null) state.gps[String(key)] = kv.Value ?? kv.value;
      }
    } else if (d.value != null) {
      const converted = convertFleetSignal(id, d.value);
      if (converted != null) signals[id] = converted;
    }
  } catch {
    state.parseErrors += 1;
  }
}

function splitFleetSseBlocks(buf) {
  // Separador de eventos no FleetBus: \r\r (também aceita \n\n / \r\n\r\n).
  return String(buf || "").split(/\r\n\r\n|\n\n|\r\r/);
}

async function collectFleetLive(vehicleId, token, waitMs = 5500) {
  // Mesmo formato do SPA FleetBus (EventSource + access_token na query).
  const url =
    `${FLEETBUS_ORIGIN}/api/v1/fluxlivedata/startConsume` +
    `?vehicleId=${encodeURIComponent(vehicleId)}` +
    `&access_token=${encodeURIComponent(token)}`;
  const signals = {};
  const state = { gps: null, faults: [], events: 0, parseErrors: 0, bytes: 0 };
  const meta = {
    httpStatus: 0,
    contentType: "",
    bytes: 0,
    events: 0,
    parseErrors: 0,
    waitedMs: 0,
    earlyExit: false,
    preview: ""
  };
  let rawPreview = "";
  const budget = Math.max(1500, Math.min(12000, Number(waitMs) || 5500));
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budget);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        "Accept-Encoding": "identity",
        Authorization: `Bearer ${token}`,
        Referer: `${FLEETBUS_ORIGIN}/on-demand/real-time`,
        Origin: FLEETBUS_ORIGIN,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: controller.signal
    });
    meta.httpStatus = res.status;
    meta.contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`FleetBus live HTTP ${res.status}${errBody ? `: ${errBody.slice(0, 120)}` : ""}`);
    }
    if (!res.body || typeof res.body.getReader !== "function") {
      const text = await res.text();
      state.bytes = text.length;
      rawPreview = text.slice(0, 240);
      const parts = splitFleetSseBlocks(text);
      for (const block of parts) ingestFleetLiveBlock(block, signals, state);
    } else {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        state.bytes += chunk.length;
        if (rawPreview.length < 240) rawPreview += chunk.slice(0, 240 - rawPreview.length);
        buf += chunk;
        const parts = splitFleetSseBlocks(buf);
        buf = parts.pop() || "";
        for (const block of parts) ingestFleetLiveBlock(block, signals, state);
        // Só encerra cedo se já tiver sinal de cluster (além do GPS).
        if (
          state.gps &&
          (state.gps["504"] != null || state.gps["505"] != null) &&
          hasCoreFleetSignals(signals) &&
          (Date.now() - started >= 1800 || state.events >= 8)
        ) {
          meta.earlyExit = true;
          controller.abort();
          break;
        }
      }
      if (buf.trim()) ingestFleetLiveBlock(buf, signals, state);
    }
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  } finally {
    clearTimeout(timer);
    meta.waitedMs = Date.now() - started;
    meta.bytes = state.bytes;
    meta.events = state.events;
    meta.parseErrors = state.parseErrors;
    meta.preview = rawPreview.replace(/access_token=[^&\s"]+/gi, "access_token=REDACTED");
  }

  return { signals, gps: state.gps, faults: state.faults || [], meta };
}

async function proxyFleetbus(event) {
  const rawPath = event.rawPath || event.path || "";
  const qs = new URLSearchParams(event.rawQueryString || "");
  const token = await ensureFleetbusToken();

  if (rawPath === "/fleetbus/vehicles" || rawPath.startsWith("/fleetbus/vehicles?")) {
    const upstream = await fleetbusFetch("/api/v1/i/vehicles?onlyVehiclesInService=true", token);
    return {
      statusCode: upstream.status,
      headers: corsHeaders(upstream.contentType),
      body: upstream.text
    };
  }

  if (rawPath.startsWith("/fleetbus/live")) {
    const vehicleId = qs.get("vehicleId");
    if (!vehicleId) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: false, erro: "Informe vehicleId." })
      };
    }
    const waitMs = Number(qs.get("waitMs") || 8000);
    const debug = qs.get("debug") === "1";
    const live = await collectFleetLive(vehicleId, token, waitMs);
    const merged = mergeFleetLiveCache(vehicleId, live.signals, live.gps, live.faults);
    const normalized = normalizeFleetSignals(merged.signals);
    const body = {
      ok: true,
      vehicleId,
      signals: merged.signals,
      normalized,
      gps: merged.gps,
      faults: merged.faults || [],
      collectedAt: new Date().toISOString()
    };
    if (debug && live.meta) body.meta = { ...live.meta, cacheSignals: Object.keys(merged.signals).length };
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(body)
    };
  }

  if (rawPath === "/fleetbus/health") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        fleetbus: !!fleetTokenCache.access || !!FLEETBUS_TOKEN,
        hasRefresh: !!(fleetTokenCache.refresh || FLEETBUS_REFRESH)
      })
    };
  }

  return {
    statusCode: 404,
    headers: corsHeaders(),
    body: JSON.stringify({ ok: false, erro: "Use /fleetbus/vehicles ou /fleetbus/live?vehicleId=..." })
  };
}

async function proxyRelatorioIa(event) {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) {
    return {
      statusCode: 503,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, erro: "GEMINI_API_KEY não configurada na Lambda." })
    };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, erro: "JSON inválido." })
    };
  }

  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, erro: "Campo prompt é obrigatório." })
    };
  }

  const modelos = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
  let ultimoErro = "Falha ao consultar Gemini.";

  for (const model of modelos) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 2048 }
      }),
      signal: AbortSignal.timeout(28000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      ultimoErro = data?.error?.message || `Gemini HTTP ${res.status}`;
      continue;
    }
    const texto = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("").trim();
    if (texto) {
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ ok: true, texto, modelo: model })
      };
    }
  }

  return {
    statusCode: 502,
    headers: corsHeaders(),
    body: JSON.stringify({ ok: false, erro: ultimoErro })
  };
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  const rawPath = event.rawPath || event.path || "";

  if (method === "GET" && (rawPath === "/" || rawPath === "")) {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        service: "portal-ciop-live-proxy",
        usage: {
          mov1: "GET /mov1/getvehicles?rt=203 — BusTime csr.mov1.com.br",
          bus2: "GET /bus2/vehicles?... — Mobilibus (legado)",
          fleetbus: "GET /fleetbus/vehicles · GET /fleetbus/live?vehicleId=",
          relatorioIa: "POST /relatorio-ia — Gemini para relatórios"
        }
      })
    };
  }

  if (method === "GET" && (rawPath === "/health" || event.path === "/health")) {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: true, service: "portal-ciop-live-proxy", bustime: !!BUSTIME_KEY, fleetbus: !!(fleetTokenCache.access || FLEETBUS_TOKEN) })
    };
  }

  try {
    if (method === "POST" && rawPath === "/relatorio-ia") return await proxyRelatorioIa(event);
    if (rawPath.startsWith("/fleetbus")) return await proxyFleetbus(event);
    if (rawPath.startsWith("/mov1")) return await proxyMov1(event);
    if (rawPath.startsWith("/bus2")) return await proxyBus2(event);
    return {
      statusCode: 404,
      headers: corsHeaders(),
      body: JSON.stringify({ ok: false, erro: "Use /mov1/..., /bus2/... ou /fleetbus/..." })
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: false,
        erro: err.cause?.message || err.message || "Falha no proxy ao vivo"
      })
    };
  }
}
