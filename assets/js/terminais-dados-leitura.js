import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from "./portal-firestore.js";
import {
  carregarSnapshotTerminaisFirestore,
  reidratarSnapshotTerminais
} from "./terminais-firestore.js";
import { carregarSnapshotAws } from "./portal-aws-config.js";

export const TERMINAIS_JSON_URL = "../assets/data/terminais-agora.json";

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

async function carregarJsonSnapshot() {
  try {
    const res = await fetch(`${TERMINAIS_JSON_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const payload = await res.json();
    return reidratarSnapshotTerminais(payload);
  } catch (_) {
    return null;
  }
}

async function carregarFirestore() {
  await aguardarAuthFirestore();
  const res = await carregarSnapshotTerminaisFirestore();
  if (!res.ok || !res.payload) return null;
  return reidratarSnapshotTerminais(res.payload);
}

async function carregarAws() {
  const snap = await carregarSnapshotAws("/terminais/atual", { timeoutMs: 12000 });
  if (!snap?.payload) return null;
  return reidratarSnapshotTerminais(snap.payload);
}

function escolherSnapshot(candidatos) {
  const validos = candidatos.filter((item) => item?.REGISTROS?.length);
  if (!validos.length) return null;
  validos.sort((a, b) => {
    const ta = new Date(a.atualizadoEm || 0).getTime();
    const tb = new Date(b.atualizadoEm || 0).getTime();
    return tb - ta;
  });
  return validos[0];
}

/** Fluxo único de leitura: AWS → Firestore → JSON. */
export async function carregarDadosTerminais({ onProgress } = {}) {
  onProgress?.("Consultando AWS, Firestore e JSON...");
  const [awsRes, fsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarAws(), 20000),
    withTimeout(carregarFirestore(), 30000),
    withTimeout(carregarJsonSnapshot(), 15000)
  ]);

  const aws = awsRes.status === "fulfilled" ? awsRes.value : null;
  const firestore = fsRes.status === "fulfilled" ? fsRes.value : null;
  const json = jsonRes.status === "fulfilled" ? jsonRes.value : null;
  const snapshot = escolherSnapshot([
    aws ? { ...aws, _origem: "AWS" } : null,
    firestore ? { ...firestore, _origem: "Firestore" } : null,
    json ? { ...json, _origem: "JSON" } : null
  ]);

  const origens = [];
  if (aws?.REGISTROS?.length) origens.push("AWS");
  if (firestore?.REGISTROS?.length) origens.push("Firestore");
  if (json?.REGISTROS?.length) origens.push("JSON");

  return {
    payload: snapshot,
    origem: snapshot?._origem || origens.join(" · ") || "",
    tentativas: [
      `AWS: ${aws?.REGISTROS?.length || 0}`,
      `Firestore: ${firestore?.REGISTROS?.length || 0}`,
      `JSON: ${json?.REGISTROS?.length || 0}`
    ]
  };
}

export { reidratarSnapshotTerminais, mapTerminalTelefoneFromPlain } from "./terminais-firestore.js";
