/* Portal CIOP — presença online + chat 1:1 no Firestore */
import { db } from "./portal-firestore.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const EMAIL_DONO_CHAT = "odair.marin@icloud.com";
export const PRESENCA_TTL_MS = 90_000;
export const PRESENCA_HEARTBEAT_MS = 30_000;

const COLECAO_PRESENCA = "presenca";
const COLECAO_SALAS = "chatSalas";

let heartbeatTimer = null;
let presenceUnsub = null;

export function normalizarEmailChat(email) {
  return String(email || "").trim().toLowerCase();
}

export function isDonoChat(email = window.portalUsuario?.email) {
  return normalizarEmailChat(email) === EMAIL_DONO_CHAT;
}

export function salaIdDm(emailA, emailB) {
  const a = normalizarEmailChat(emailA);
  const b = normalizarEmailChat(emailB);
  if (!a || !b || a === b) return "";
  return ["dm", ...[a, b].sort()].join("__");
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
  const email = normalizarEmailChat(cadastro?.email);
  if (!email) return;
  const ref = doc(db, COLECAO_PRESENCA, email);
  await setDoc(
    ref,
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
  const key = normalizarEmailChat(email);
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

  window.addEventListener("beforeunload", () => {
    // best-effort; may not always flush
    marcarPresencaOffline(cadastro?.email);
  });
}

export function pararHeartbeatPresenca() {
  if (heartbeatTimer) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function ouvirPresenca(callback) {
  if (typeof presenceUnsub === "function") {
    presenceUnsub();
    presenceUnsub = null;
  }
  const q = query(collection(db, COLECAO_PRESENCA));
  presenceUnsub = onSnapshot(
    q,
    (snap) => {
      const agora = agoraMs();
      const lista = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => presencaEstaOnline(u, agora))
        .sort((a, b) => String(a.nome || a.email).localeCompare(String(b.nome || b.email), "pt-BR"));
      callback(lista);
    },
    (err) => {
      console.warn("Falha ao ouvir presença:", err);
      callback([]);
    }
  );
  return () => {
    if (typeof presenceUnsub === "function") presenceUnsub();
    presenceUnsub = null;
  };
}

export async function garantirSalaDm(emailA, emailB) {
  const a = normalizarEmailChat(emailA);
  const b = normalizarEmailChat(emailB);
  const salaId = salaIdDm(a, b);
  if (!salaId) throw new Error("Informe dois usuários distintos para a conversa.");

  const ref = doc(db, COLECAO_SALAS, salaId);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: salaId, ...snap.data() };

  const payload = {
    tipo: "dm",
    membros: [a, b].sort(),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
    ultimaMensagem: "",
    ultimaMensagemEm: null,
    criadoPor: a
  };
  await setDoc(ref, payload);
  return { id: salaId, ...payload };
}

export async function enviarMensagem(salaId, texto, de = window.portalUsuario?.email) {
  const email = normalizarEmailChat(de);
  const body = String(texto || "").trim();
  if (!salaId || !email) throw new Error("Conversa inválida.");
  if (!body) throw new Error("Digite uma mensagem.");
  if (body.length > 4000) throw new Error("Mensagem muito longa (máx. 4000).");

  const salaRef = doc(db, COLECAO_SALAS, salaId);
  const msgs = collection(salaRef, "mensagens");
  const docRef = await addDoc(msgs, {
    de: email,
    texto: body,
    criadoEm: serverTimestamp()
  });
  await updateDoc(salaRef, {
    ultimaMensagem: body.slice(0, 240),
    ultimaMensagemEm: serverTimestamp(),
    atualizadoEm: serverTimestamp()
  });
  return docRef.id;
}

export function ouvirMensagens(salaId, callback, max = 200) {
  const q = query(
    collection(db, COLECAO_SALAS, salaId, "mensagens"),
    orderBy("criadoEm", "asc"),
    limit(max)
  );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(msgs);
    },
    (err) => {
      console.warn("Falha ao ouvir mensagens:", err);
      callback([]);
    }
  );
}

export async function listarMinhasSalas(email = window.portalUsuario?.email) {
  const key = normalizarEmailChat(email);
  if (!key) return [];
  const q = query(collection(db, COLECAO_SALAS), where("membros", "array-contains", key));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.atualizadoEm?.toMillis?.() || 0;
      const tb = b.atualizadoEm?.toMillis?.() || 0;
      return tb - ta;
    });
}

export async function listarTodasSalas() {
  const snap = await getDocs(collection(db, COLECAO_SALAS));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.atualizadoEm?.toMillis?.() || 0;
      const tb = b.atualizadoEm?.toMillis?.() || 0;
      return tb - ta;
    });
}

export function formatarHoraMensagem(valor) {
  let date = null;
  if (valor?.toDate) date = valor.toDate();
  else if (valor instanceof Date) date = valor;
  else if (typeof valor === "number") date = new Date(valor);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
