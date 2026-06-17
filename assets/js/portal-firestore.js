import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLECAO_USUARIOS = "usuarios";

export function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizarCadastro(cadastro, email) {
  if (typeof cadastro === "string") {
    return { email: normalizarEmail(email), nome: email, perfil: cadastro };
  }
  return {
    email: normalizarEmail(cadastro?.email || email),
    nome: cadastro?.nome || email,
    perfil: cadastro?.perfil || "Usuario"
  };
}

export async function buscarUsuarioFirestore(email) {
  const id = normalizarEmail(email);
  if (!id) return null;
  const snap = await getDoc(doc(db, COLECAO_USUARIOS, id));
  return snap.exists() ? normalizarCadastro(snap.data(), id) : null;
}

export async function listarUsuariosFirestore() {
  const snap = await getDocs(collection(db, COLECAO_USUARIOS));
  const lista = {};
  snap.forEach((item) => {
    lista[item.id] = normalizarCadastro(item.data(), item.id);
  });
  return lista;
}

export async function salvarUsuarioFirestore(email, cadastro) {
  const id = normalizarEmail(email);
  if (!id) throw new Error("E-mail invalido.");
  const dados = normalizarCadastro({ ...cadastro, email: id }, id);
  await setDoc(doc(db, COLECAO_USUARIOS, id), {
    email: id,
    nome: dados.nome,
    perfil: dados.perfil,
    atualizadoEm: serverTimestamp()
  }, { merge: true });
  return dados;
}
