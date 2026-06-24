import { db } from "./portal-firestore.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const COLECAO_TERMINAIS = "terminaisAgora";
export const DOC_SNAPSHOT = "atual";

export async function carregarSnapshotTerminaisFirestore() {
  const snap = await getDoc(doc(db, COLECAO_TERMINAIS, DOC_SNAPSHOT));
  if (!snap.exists()) return { ok: false, payload: null, origem: "firestore" };
  return { ok: true, payload: snap.data(), origem: "firestore" };
}

export function reidratarSnapshotTerminais(payload) {
  if (!payload) return null;
  return {
    DADOS: payload.DADOS || [],
    MAP_TERMINAL_TELEFONE: payload.MAP_TERMINAL_TELEFONE || {},
    REGISTROS: (payload.REGISTROS || []).map((item) => ({
      ...item,
      data: item.data ? new Date(item.data) : null,
      start: item.start ? new Date(item.start) : null,
      end: item.end ? new Date(item.end) : null
    })),
    atualizadoEm: payload.atualizadoEm || null,
    fonte: payload.fonte || ""
  };
}

export function mapTerminalTelefoneFromPlain(obj) {
  if (obj instanceof Map) return obj;
  return new Map(Object.entries(obj || {}));
}
