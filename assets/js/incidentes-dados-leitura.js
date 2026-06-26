import { carregarSnapshotAws } from "./portal-aws-config.js";

export function normalizarDataIsoIncidente(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(br) ? br.slice(0, 10) : "";
}

export function idIncidente(row) {
  return String(row?.incidentId || row?.id || "").trim();
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), ms);
    })
  ]);
}

async function carregarDoBanco() {
  const snap = await carregarSnapshotAws("/snapshots/incidentes", { timeoutMs: 20000 });
  if (!snap?.payload) return null;
  const incidentes = Array.isArray(snap.payload?.incidentes) ? snap.payload.incidentes : [];
  const atualizadoEm = snap.atualizadoEm || snap.payload?.atualizadoEm || null;
  const payload = {
    ...snap.payload,
    incidentes,
    totalExtraido: incidentes.length,
    atualizadoEm
  };
  return { payload, incidentes, atualizadoEm };
}

/** Leitura: Aurora DSQL via API AWS. Cache local fica no dashboard. */
export async function carregarDadosIncidentes({ onProgress } = {}) {
  onProgress?.("Consultando banco de dados...");
  const res = await withTimeout(carregarDoBanco(), 22000);
  if (!res?.incidentes?.length) {
    throw new Error("Nenhum incidente no banco de dados (AWS/DSQL).");
  }
  return {
    payload: res.payload,
    origem: "AWS",
    tentativas: [`DSQL: ${res.incidentes.length}`]
  };
}
