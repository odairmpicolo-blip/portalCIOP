/**
 * Trilha de uso do portal (Firestore `auditoriaPortal`).
 * Qualquer logado grava o próprio evento; só o dono lê o histórico.
 */
import { db } from "./portal-firestore.js";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const COLECAO_AUDITORIA = "auditoriaPortal";
const THROTTLE_MS = 90_000;

function emailAtual() {
  return String(window.portalUsuario?.email || "").trim().toLowerCase();
}

function paginaAtual(pagina) {
  const bruto = String(pagina || location.pathname || "")
    .split("?")[0]
    .split("#")[0];
  const partes = bruto.split("/").filter(Boolean);
  return partes[partes.length - 1] || "index.html";
}

export async function registrarAuditoria(dados = {}) {
  const email = emailAtual();
  if (!email) return;
  const acao = String(dados.acao || "pagina").slice(0, 40);
  const pagina = paginaAtual(dados.pagina);
  if (pagina === "login.html") return;

  if (acao === "pagina" || acao === "entrou") {
    const chave = "portal-audit:" + acao + ":" + pagina;
    try {
      const ultimo = Number(sessionStorage.getItem(chave) || 0);
      if (Date.now() - ultimo < THROTTLE_MS) return;
      sessionStorage.setItem(chave, String(Date.now()));
    } catch (_) {}
  }

  const cadastro = window.portalUsuario || {};
  try {
    await addDoc(collection(db, COLECAO_AUDITORIA), {
      email,
      nome: String(cadastro.nome || email).trim().slice(0, 120),
      perfil: String(cadastro.perfil || "").trim().slice(0, 40),
      acao,
      pagina,
      titulo: String(dados.titulo || document.title || "").slice(0, 160),
      detalhe: String(dados.detalhe || "").slice(0, 400),
      createdMs: Date.now()
    });
  } catch (err) {
    console.warn("Auditoria não gravada:", err?.code || err?.message || err);
  }
}

export async function listarAuditoria(limite = 400) {
  const snap = await getDocs(
    query(collection(db, COLECAO_AUDITORIA), orderBy("createdMs", "desc"), limit(limite))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

window.portalRegistrarAuditoria = registrarAuditoria;
