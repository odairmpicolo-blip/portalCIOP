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

const SALAS_LOCAL_KEY = "portal_chat_salas_conhecidas_v1";

function lerSalasLocais(email) {
  const key = normalizarEmailChat(email);
  if (!key) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SALAS_LOCAL_KEY) || "{}");
    const lista = parsed?.[key];
    return Array.isArray(lista) ? lista.filter(Boolean) : [];
  } catch (_) {
    return [];
  }
}

export function lembrarSalaLocal(salaId, email = window.portalUsuario?.email) {
  const key = normalizarEmailChat(email);
  if (!key || !salaId) return;
  try {
    const parsed = JSON.parse(localStorage.getItem(SALAS_LOCAL_KEY) || "{}");
    const atual = Array.isArray(parsed[key]) ? parsed[key] : [];
    if (!atual.includes(salaId)) {
      parsed[key] = [salaId, ...atual].slice(0, 80);
      localStorage.setItem(SALAS_LOCAL_KEY, JSON.stringify(parsed));
    }
  } catch (_) {}
}

async function repararMembrosSala(salaId, data, emailsExtra = []) {
  const atuais = Array.isArray(data?.membros) ? data.membros : [];
  const normalizados = [...new Set([
    ...atuais.map(normalizarEmailChat),
    ...emailsExtra.map(normalizarEmailChat)
  ].filter(Boolean))].sort();
  const iguais = atuais.length === normalizados.length
    && atuais.every((v, i) => v === normalizados[i]);
  if (iguais) return { id: salaId, ...data, membros: normalizados };
  try {
    await updateDoc(doc(db, COLECAO_SALAS, salaId), { membros: normalizados });
  } catch (err) {
    console.warn("Não foi possível reparar membros da sala:", err);
  }
  return { id: salaId, ...data, membros: normalizados };
}

function mesclarSalasPorId(listas) {
  const mapa = new Map();
  (listas || []).flat().forEach((sala) => {
    if (!sala?.id) return;
    const prev = mapa.get(sala.id);
    if (!prev) {
      mapa.set(sala.id, sala);
      return;
    }
    const tPrev = timestampMs(prev.atualizadoEm || prev.ultimaMensagemEm);
    const tNovo = timestampMs(sala.atualizadoEm || sala.ultimaMensagemEm);
    if (tNovo >= tPrev) mapa.set(sala.id, sala);
  });
  return [...mapa.values()].sort(
    (a, b) => timestampMs(b.atualizadoEm || b.ultimaMensagemEm) - timestampMs(a.atualizadoEm || a.ultimaMensagemEm)
  );
}

export async function buscarSalasPorIds(ids = []) {
  const unicos = [...new Set((ids || []).filter(Boolean))];
  const salas = [];
  for (const salaId of unicos) {
    try {
      const snap = await getDoc(doc(db, COLECAO_SALAS, salaId));
      if (!snap.exists()) continue;
      const reparada = await repararMembrosSala(salaId, snap.data());
      salas.push(reparada);
      lembrarSalaLocal(salaId);
    } catch (_) {}
  }
  return salas;
}

export async function descobrirSalasComEmails(meuEmail, emails = []) {
  const me = normalizarEmailChat(meuEmail);
  const ids = (emails || []).map((e) => salaIdDm(me, e)).filter(Boolean);
  return buscarSalasPorIds(ids);
}

export async function garantirSalaDm(emailA, emailB) {
  const a = normalizarEmailChat(emailA);
  const b = normalizarEmailChat(emailB);
  const salaId = salaIdDm(a, b);
  if (!salaId) throw new Error("Informe dois usuários distintos para a conversa.");

  const ref = doc(db, COLECAO_SALAS, salaId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const reparada = await repararMembrosSala(salaId, snap.data(), [a, b]);
    lembrarSalaLocal(salaId, a);
    lembrarSalaLocal(salaId, b);
    return reparada;
  }

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
  lembrarSalaLocal(salaId, a);
  lembrarSalaLocal(salaId, b);
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
    ultimaMensagemDe: email,
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
  let querySalas = [];
  try {
    const q = query(collection(db, COLECAO_SALAS), where("membros", "array-contains", key));
    const snap = await getDocs(q);
    querySalas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Falha ao listar salas (query):", err);
  }
  const locais = await buscarSalasPorIds(lerSalasLocais(key));
  return mesclarSalasPorId([querySalas, locais]);
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

export function timestampMs(valor) {
  if (valor?.toMillis) return valor.toMillis();
  if (valor instanceof Timestamp) return valor.toMillis();
  if (typeof valor === "number") return valor;
  if (valor?.seconds) return valor.seconds * 1000;
  return 0;
}

export function outroMembroSala(sala, meuEmail) {
  const me = normalizarEmailChat(meuEmail);
  return (sala?.membros || [])
    .map(normalizarEmailChat)
    .find((email) => email && email !== me) || "";
}

const LIDOS_KEY = "portal_chat_lidos_v1";

export function lerMapaLidos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIDOS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function marcarSalaLida(salaId, ts = Date.now()) {
  if (!salaId) return;
  const mapa = lerMapaLidos();
  mapa[salaId] = Math.max(Number(mapa[salaId] || 0), Number(ts) || Date.now());
  try {
    localStorage.setItem(LIDOS_KEY, JSON.stringify(mapa));
  } catch (_) {}
}

export function salaTemNaoLida(sala, meuEmail) {
  if (!sala?.id || !sala.ultimaMensagem) return false;
  const de = normalizarEmailChat(sala.ultimaMensagemDe);
  const me = normalizarEmailChat(meuEmail);
  // Se soubermos que a última mensagem é minha, não conta como não lida.
  if (de && de === me) return false;
  const msgTs = timestampMs(sala.ultimaMensagemEm || sala.atualizadoEm);
  if (!msgTs) return false;
  return msgTs > Number(lerMapaLidos()[sala.id] || 0);
}

export function contarNaoLidas(salas, meuEmail) {
  return (salas || []).filter((sala) => salaTemNaoLida(sala, meuEmail)).length;
}

export function ouvirMinhasSalas(email, callback) {
  const key = normalizarEmailChat(email);
  if (!key) {
    callback([]);
    return () => {};
  }

  let querySalas = [];
  let extrasSalas = [];
  let cancelado = false;

  const emitir = () => {
    if (cancelado) return;
    callback(mesclarSalasPorId([querySalas, extrasSalas]));
  };

  const carregarExtras = async (emailsOnline = []) => {
    try {
      const descobertas = await descobrirSalasComEmails(key, emailsOnline);
      const locais = await buscarSalasPorIds(lerSalasLocais(key));
      extrasSalas = mesclarSalasPorId([descobertas, locais]);
      emitir();
    } catch (err) {
      console.warn("Falha ao carregar salas extras:", err);
    }
  };

  carregarExtras([]);

  const q = query(collection(db, COLECAO_SALAS), where("membros", "array-contains", key));
  const unsub = onSnapshot(
    q,
    (snap) => {
      querySalas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      querySalas.forEach((s) => lembrarSalaLocal(s.id, key));
      emitir();
    },
    (err) => {
      console.warn("Falha ao ouvir salas de chat:", err);
      querySalas = [];
      emitir();
    }
  );

  ouvirMinhasSalas.redescobrir = (emailsOnline = []) => carregarExtras(emailsOnline);

  return () => {
    cancelado = true;
    unsub();
  };
}
