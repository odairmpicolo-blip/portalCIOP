/**
 * Presença de usuários logados no portal (Firestore `presenca`).
 * Independente do chat, que foi removido.
 */
import { db } from "./portal-firestore.js";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const PRESENCA_TTL_MS = 90_000;
export const PRESENCA_HEARTBEAT_MS = 30_000;

const COLECAO_PRESENCA = "presenca";

let heartbeatTimer = null;
let presenceUnsub = null;
let unloadBound = false;

function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function agoraMs() {
  return Date.now();
}

export function presencaEstaOnline(docData, agora = agoraMs()) {
  if (!docData || docData.status === "offline") return false;
  const last = docData.lastSeen;
  let ms = 0;
  if (last?.toMillis) ms = last.toMillis();
  else if (last instanceof Timestamp) ms = last.toMillis();
  else if (typeof last === "number") ms = last;
  else if (last?.seconds) ms = last.seconds * 1000;
  if (!ms) return false;
  return agora - ms <= PRESENCA_TTL_MS;
}

export async function marcarPresencaOnline(cadastro = window.portalUsuario) {
  const email = normalizarEmail(cadastro?.email);
  if (!email) return;
  await setDoc(
    doc(db, COLECAO_PRESENCA, email),
    {
      email,
      nome: String(cadastro?.nome || email).trim(),
      perfil: String(cadastro?.perfil || "").trim(),
      cargo: String(cadastro?.cargo || "").trim(),
      status: "online",
      lastSeen: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    },
    { merge: true }
  );
}

export async function marcarPresencaOffline(email = window.portalUsuario?.email) {
  const key = normalizarEmail(email);
  if (!key) return;
  try {
    await setDoc(
      doc(db, COLECAO_PRESENCA, key),
      {
        status: "offline",
        lastSeen: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );
  } catch (_) {}
}

export function iniciarHeartbeatPresenca(cadastro = window.portalUsuario) {
  pararHeartbeatPresenca();
  marcarPresencaOnline(cadastro).catch(() => null);
  heartbeatTimer = window.setInterval(() => {
    marcarPresencaOnline(cadastro).catch(() => null);
  }, PRESENCA_HEARTBEAT_MS);

  if (!unloadBound) {
    unloadBound = true;
    window.addEventListener("pagehide", () => {
      marcarPresencaOffline(window.portalUsuario?.email);
    });
  }
}

export function pararHeartbeatPresenca() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

const presenceListeners = new Set();

function emitirPresenca(lista) {
  presenceListeners.forEach((cb) => {
    try { cb(lista); } catch (_) {}
  });
  try {
    window.dispatchEvent(new CustomEvent("portal:presenca", { detail: { usuarios: lista } }));
  } catch (_) {}
}

export function ouvirPresenca(callback) {
  if (typeof callback !== "function") return () => {};
  presenceListeners.add(callback);

  if (!presenceUnsub) {
    presenceUnsub = onSnapshot(
      query(collection(db, COLECAO_PRESENCA)),
      (snap) => {
        const agora = agoraMs();
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => presencaEstaOnline(u, agora))
          .sort((a, b) => String(a.nome || a.email).localeCompare(String(b.nome || b.email), "pt-BR"));
        emitirPresenca(lista);
      },
      (err) => {
        console.warn("Falha ao ouvir presença:", err);
        emitirPresenca([]);
      }
    );
  }

  return () => {
    presenceListeners.delete(callback);
    if (!presenceListeners.size && typeof presenceUnsub === "function") {
      presenceUnsub();
      presenceUnsub = null;
    }
  };
}
