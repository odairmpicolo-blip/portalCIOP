import { db } from "./portal-firestore.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const COLECAO = "performanceHoras";
export const LOCAL_DIAS_KEY = "ciop-mapa-pontualidade-dias-v1";
export const LOCAL_HOJE_KEY = "ciop-mapa-pontualidade-horas-v1";
export const MAX_DIAS_LOCAL = 90;

export function hojeSP(ref = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(ref);
}

export function horaSP(ref = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hour12: false
  }).formatToParts(ref);
  return Number((p.find((x) => x.type === "hour") || {}).value || 0);
}

export function mergeHoras(a = {}, b = {}) {
  const out = { ...(a || {}) };
  Object.entries(b || {}).forEach(([h, ponto]) => {
    if (!ponto || typeof ponto !== "object") return;
    out[h] = { ...(out[h] || {}), ...ponto };
  });
  return out;
}

export function pontoDaAmostra(d, ref = new Date()) {
  return {
    [String(horaSP(ref))]: {
      ok: d?.total?.ok ?? null,
      late: d?.total?.late ?? null,
      early: d?.total?.early ?? null,
      tcgl: d?.tcgl || null,
      ls: d?.ls || null,
      ts: Date.now()
    }
  };
}

export function lerArquivoLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_DIAS_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (_) {
    return {};
  }
}

export function gravarArquivoLocal(dias) {
  const keys = Object.keys(dias || {}).sort();
  while (keys.length > MAX_DIAS_LOCAL) {
    delete dias[keys.shift()];
  }
  try {
    localStorage.setItem(LOCAL_DIAS_KEY, JSON.stringify(dias));
  } catch (_) {}
}

export function arquivarLocal(dia) {
  if (!dia?.date) return null;
  const all = lerArquivoLocal();
  const prev = all[dia.date] || { date: dia.date, horas: {} };
  const next = {
    date: dia.date,
    horas: mergeHoras(prev.horas, dia.horas),
    total: dia.total || prev.total || null,
    tcgl: dia.tcgl || prev.tcgl || null,
    ls: dia.ls || prev.ls || null,
    atualizado: dia.atualizado || prev.atualizado || "",
    ts: Date.now(),
    origem: "local"
  };
  all[dia.date] = next;
  gravarArquivoLocal(all);
  return next;
}

export function importarHojeLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_HOJE_KEY) || "null");
    if (raw?.date && raw.horas) return arquivarLocal(raw);
  } catch (_) {}
  return null;
}

export async function listarDiasFirestore() {
  const snap = await getDocs(collection(db, COLECAO));
  const dias = {};
  snap.forEach((item) => {
    const data = item.data() || {};
    dias[item.id] = { date: item.id, ...data, origem: "firestore" };
  });
  return dias;
}

export async function salvarDiaFirestore(dia, email) {
  if (!dia?.date) throw new Error("Dia sem data");
  const ref = doc(db, COLECAO, dia.date);
  const atual = await getDoc(ref);
  const prev = atual.exists() ? atual.data() : {};
  const payload = {
    date: dia.date,
    horas: mergeHoras(prev.horas, dia.horas),
    total: dia.total || prev.total || null,
    tcgl: dia.tcgl || prev.tcgl || null,
    ls: dia.ls || prev.ls || null,
    atualizado: dia.atualizado || prev.atualizado || "",
    salvoEm: serverTimestamp(),
    salvoPor: email || prev.salvoPor || ""
  };
  await setDoc(ref, payload, { merge: true });
  return payload;
}

export function unirDias(firestoreDias = {}, localDias = {}) {
  const out = {};
  const ids = new Set([...Object.keys(firestoreDias), ...Object.keys(localDias)]);
  ids.forEach((id) => {
    const a = firestoreDias[id];
    const b = localDias[id];
    if (a && b) {
      out[id] = {
        ...b,
        ...a,
        date: id,
        horas: mergeHoras(b.horas, a.horas),
        origem: "firestore"
      };
    } else {
      out[id] = { ...(a || b), date: id };
    }
  });
  return out;
}

export function serieDoDia(dia, campo, lado = "total") {
  return Array.from({ length: 24 }, (_, h) => {
    const p = dia?.horas?.[String(h)];
    if (!p) return null;
    let v = null;
    if (lado === "tcgl") v = p.tcgl?.[campo];
    else if (lado === "ls") v = p.ls?.[campo];
    else v = p[campo];
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
}

export function ultimoPonto(dia, lado = "total") {
  const horas = Object.keys(dia?.horas || {})
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!horas.length) return null;
  const p = dia.horas[String(horas[horas.length - 1])];
  if (lado === "tcgl") return p?.tcgl || null;
  if (lado === "ls") return p?.ls || null;
  return { ok: p?.ok, late: p?.late, early: p?.early };
}

export function horasCapturadas(dia) {
  return Object.keys(dia?.horas || {}).filter((h) => dia.horas[h]).length;
}
