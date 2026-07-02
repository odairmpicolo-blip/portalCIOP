/**
 * Snapshot JSON estático (GitHub Pages) — carrega telemetria sem autenticação AWS.
 */
export const TELEMETRIA_DATA_BASE = "../assets/data/telemetria";
export const TELEMETRIA_DADOS_URL = `${TELEMETRIA_DATA_BASE}/dados.json`;
export const TELEMETRIA_MANIFEST_URL = `${TELEMETRIA_DATA_BASE}/manifest.json`;

export async function carregarManifestTelemetria() {
  try {
    const res = await fetch(`${TELEMETRIA_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

export async function carregarSnapshotTelemetriaJson() {
  try {
    const res = await fetch(`${TELEMETRIA_DADOS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.dados) || !data.dados.length) return null;
    return data;
  } catch (_) {
    return null;
  }
}
