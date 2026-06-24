import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from "./portal-firestore.js";
import { carregarTodosAutuacoesFirestore } from "./autuacoes-firestore.js";
import { carregarSnapshotAws } from "./portal-aws-config.js";

export const AUTUACOES_API_URL = "https://script.google.com/macros/s/AKfycbylz8scwboPQLeOKWUpw9YqKxomjts1aa8KUwodAuq5IE3T9s7RXd6GJcfMnS9qu6DI/exec";
export const AUTUACOES_DATA_BASE = "../assets/data/autuacoes";
export const AUTUACOES_SNAPSHOT_URL = `${AUTUACOES_DATA_BASE}/dados.json`;
export const AUTUACOES_DATA_INICIO = "2015-01-01";
export const SYNC_DIAS_RECENTES = 14;

function chaveRegistro(row) {
  return [
    row?.data_iso || row?.data_br || "",
    row?.notificacao || "",
    row?.auto || "",
    row?.ordem || ""
  ].join("|");
}

function mesclarLinhas(listas) {
  const mapa = new Map();
  listas.forEach((lista) => {
    (lista || []).forEach((row) => {
      if (!row) return;
      mapa.set(chaveRegistro(row), row);
    });
  });
  return [...mapa.values()];
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), ms);
    })
  ]);
}

async function aguardarAuthFirestore() {
  const auth = getAuth(app);
  if (typeof auth.authStateReady === "function") await auth.authStateReady();
  return auth.currentUser;
}

function isoHoje() {
  return new Date().toISOString().slice(0, 10);
}

function isoDiasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

async function carregarJsonSnapshot() {
  try {
    const res = await fetch(`${AUTUACOES_SNAPSHOT_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { payload: null, rows: [] };
    const payload = await res.json();
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    return { payload, rows };
  } catch (_) {
    return { payload: null, rows: [] };
  }
}

async function carregarFirestore() {
  await aguardarAuthFirestore();
  const res = await carregarTodosAutuacoesFirestore();
  return res?.dados || [];
}

async function carregarPlanilhaRecentes() {
  const url = `${AUTUACOES_API_URL}?${new URLSearchParams({
    data_de: isoDiasAtras(SYNC_DIAS_RECENTES),
    data_ate: isoHoje(),
    completo: "0",
    _: String(Date.now())
  })}`;
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.status === "error") throw new Error(payload.message || "Erro na API");
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function carregarPlanilhaCompleta() {
  const url = `${AUTUACOES_API_URL}?${new URLSearchParams({
    data_de: AUTUACOES_DATA_INICIO,
    data_ate: isoHoje(),
    completo: "1",
    _: String(Date.now())
  })}`;
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.status === "error") throw new Error(payload.message || "Erro na API");
  return { payload, rows: Array.isArray(payload?.data) ? payload.data : [] };
}

async function carregarAws() {
  const snap = await carregarSnapshotAws("/snapshots/autuacoes", { timeoutMs: 12000 });
  if (!snap?.payload) return { payload: null, rows: [] };
  const rows = Array.isArray(snap.payload?.data) ? snap.payload.data : [];
  return { payload: snap.payload, rows };
}

/**
 * Fluxo único de leitura: AWS → Firestore → JSON → planilha (recente ou completa).
 * Somente consulta — dados vêm da planilha via import/admin.
 */
export async function carregarDadosAutuacoes({ onProgress } = {}) {
  const tentativas = [];
  const origens = [];

  onProgress?.("Consultando AWS, Firestore e JSON...");
  const [awsRes, fsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarAws(), 15000),
    withTimeout(carregarFirestore(), 45000),
    withTimeout(carregarJsonSnapshot(), 20000)
  ]);

  const awsPack = awsRes.status === "fulfilled" ? awsRes.value : { payload: null, rows: [] };
  const aws = awsPack.rows || [];
  const firestore = fsRes.status === "fulfilled" ? fsRes.value : [];
  const jsonPayload = jsonRes.status === "fulfilled" ? jsonRes.value : { payload: null, rows: [] };
  const json = jsonPayload.rows || [];

  tentativas.push(`AWS: ${aws.length}`);
  tentativas.push(`Firestore: ${firestore.length}`);
  tentativas.push(`JSON: ${json.length}`);

  let dados = mesclarLinhas([json, firestore, aws]);
  if (aws.length) origens.push("AWS");
  if (firestore.length) origens.push("Firestore");
  if (json.length) origens.push("JSON");

  onProgress?.("Complementando com planilha...");
  try {
    const recentes = await withTimeout(carregarPlanilhaRecentes(), 60000);
    tentativas.push(`planilha recente: ${recentes.length}`);
    if (recentes.length) {
      dados = mesclarLinhas([dados, recentes]);
      origens.push("planilha");
    }
  } catch (err) {
    tentativas.push(`planilha recente: ${err.message === "timeout" ? "timeout" : "erro"}`);
  }

  if (!dados.length) {
    onProgress?.("Buscando planilha completa...");
    try {
      const completa = await withTimeout(carregarPlanilhaCompleta(), 120000);
      tentativas.push(`planilha completa: ${completa.rows.length}`);
      if (completa.rows.length) {
        dados = completa.rows;
        origens.push("planilha");
        return {
          dados,
          payload: completa.payload,
          origem: origens.join(" · ") || "",
          tentativas
        };
      }
    } catch (err) {
      tentativas.push(`planilha completa: ${err.message === "timeout" ? "timeout" : "erro"}`);
    }
  }

  return {
    dados,
    payload: jsonPayload.payload,
    origem: origens.join(" · ") || "",
    tentativas
  };
}
