/**
 * API AWS (DSQL/RDS) + runtime config + snapshots.
 * Defina antes dos módulos de dados, se necessário:
 *   window.PORTAL_AWS_API_URL = "https://sua-api.amazonaws.com";
 */
import { mensagemErroPortal } from "./portal-dashboard-ui.js";
let runtimeReady = false;
let runtimePromise = null;

export function getPortalAwsApiUrl() {
  return (typeof window !== "undefined" && window.PORTAL_AWS_API_URL) || "";
}

export function awsApiEnabled() {
  return Boolean(getPortalAwsApiUrl());
}

export async function awsFetch(path, { method = "GET", body, token, apiKey } = {}) {
  const apiUrl = getPortalAwsApiUrl();
  if (!apiUrl) throw new Error("PORTAL_AWS_API_URL não configurada");
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers["X-Portal-Api-Key"] = apiKey;
  let res;
  try {
    res = await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (/load failed|failed to fetch|networkerror/i.test(msg)) {
      throw new Error(mensagemErroPortal(err));
    }
    throw err;
  }
  const texto = await res.text();
  const t = String(texto || "").trim();
  let data = {};
  if (t.charAt(0) === "<") {
    throw new Error(res.ok ? "A API devolveu HTML em vez de JSON" : `HTTP ${res.status}`);
  }
  if (t) {
    try {
      data = JSON.parse(t);
    } catch (_) {
      throw new Error("A API devolveu JSON inválido ou truncado");
    }
  }
  if (!res.ok) {
    if (res.status === 504 || res.status === 502) {
      const timeout = new Error("A API demorou demais. Tente de novo; envios grandes seguem em lotes menores.");
      timeout.status = res.status;
      timeout.codigo = "TIMEOUT";
      throw timeout;
    }
    const err = new Error(mensagemErroPortal({
      codigo: data.codigo,
      message: data.erro || `HTTP ${res.status}`,
      status: res.status
    }));
    err.status = res.status;
    err.codigo = data.codigo || "ERRO";
    throw err;
  }
  return data;
}

export async function firebaseIdToken(options = {}) {
  const forceRefresh = options === true || options?.forceRefresh === true;
  const { getAuth } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
  const { app } = await import("./portal-firestore.js");
  const auth = getAuth(app);
  if (typeof auth.authStateReady === "function") await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado");
  return user.getIdToken(forceRefresh);
}

function runtimeConfigUrls() {
  const urls = [];
  try {
    urls.push(new URL("../data/portal-runtime.json", import.meta.url).href);
  } catch (_) {
    /* import.meta indisponível */
  }
  if (typeof window !== "undefined") {
    const base = window.location.pathname.replace(/\/pages\/.*$/, "").replace(/\/$/, "");
    urls.push(`${base}/assets/data/portal-runtime.json`);
    urls.push("../assets/data/portal-runtime.json");
  }
  return urls;
}

function shouldUseApiUrl(url) {
  if (!url || typeof window === "undefined") return Boolean(url);
  const isLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
  const onLocalPage = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  if (isLocalApi && !onLocalPage) return false;
  return true;
}

export async function initPortalAwsRuntime() {
  if (runtimeReady) return;
  if (typeof window !== "undefined" && window.PORTAL_AWS_API_URL) {
    runtimeReady = true;
    return;
  }
  if (!runtimePromise) {
    runtimePromise = (async () => {
      try {
        for (const configUrl of runtimeConfigUrls()) {
          try {
            const res = await fetch(`${configUrl}?t=${Date.now()}`, { cache: "no-store" });
            if (!res.ok) continue;
            const cfg = await res.json();
            const url = String(cfg?.awsApiUrl || "").trim();
            const devApiKey = String(cfg?.devApiKey || "").trim();
            if (typeof window !== "undefined") {
              if (url && shouldUseApiUrl(url)) window.PORTAL_AWS_API_URL = url;
              if (devApiKey) window.PORTAL_DEV_API_KEY = devApiKey;
            }
            break;
          } catch (_) {
            continue;
          }
        }
      } finally {
        runtimeReady = true;
      }
    })();
  }
  await runtimePromise;
}

export async function carregarSnapshotAws(path, { timeoutMs = 15000 } = {}) {
  await initPortalAwsRuntime();
  if (!awsApiEnabled()) return null;

  const devApiKey = typeof window !== "undefined" ? window.PORTAL_DEV_API_KEY : "";
  const headers = { apiKey: devApiKey || undefined };

  try {
    const token = await firebaseIdToken();
    headers.token = token;
  } catch (_) {
    if (!devApiKey) return null;
  }

  const result = await Promise.race([
    awsFetch(path, headers),
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
    })
  ]);
  if (!result?.payload) return null;
  return {
    payload: result.payload,
    atualizadoEm: result.atualizadoEm || result.payload?.atualizadoEm || null,
    origem: "AWS"
  };
}
