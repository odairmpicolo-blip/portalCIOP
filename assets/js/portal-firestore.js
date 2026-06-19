import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

const COLECAO_USUARIOS = "usuarios";
const COLECAO_AVISOS = "avisos";

export function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizarCadastro(cadastro, email) {
  if (typeof cadastro === "string") {
    return { email: normalizarEmail(email), nome: email, perfil: cadastro, registro: "", ativo: true };
  }
  return {
    email: normalizarEmail(cadastro?.email || email),
    nome: cadastro?.nome || email,
    perfil: cadastro?.perfil || "Usuario",
    registro: String(cadastro?.registro ?? cadastro?.matricula ?? cadastro?.regist ?? "").trim(),
    ativo: cadastro?.ativo !== false
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
    registro: dados.registro,
    ativo: dados.ativo !== false,
    atualizadoEm: serverTimestamp()
  }, { merge: true });
  return dados;
}

export async function excluirUsuarioFirestore(email) {
  const id = normalizarEmail(email);
  if (!id) throw new Error("E-mail invalido.");
  await deleteDoc(doc(db, COLECAO_USUARIOS, id));
}

function normalizarTextoAviso(valor) {
  return String(valor || "").normalize("NFC").trim();
}

function normalizarListaAviso(valor) {
  if (Array.isArray(valor)) {
    return valor.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(valor || "")
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizarPerfilAviso(perfil) {
  return String(perfil || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function criarPerfisRegraAviso(perfis) {
  const variantes = new Set();
  normalizarListaAviso(perfis).forEach((perfil) => {
    const original = String(perfil || "").trim();
    const semAcento = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    [original, semAcento, original.toLowerCase(), semAcento.toLowerCase()].forEach((item) => {
      if (item) variantes.add(item);
    });
  });
  return [...variantes];
}

function normalizarDataAviso(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (valor?.toDate) {
    const data = valor.toDate();
    return Number.isNaN(data.getTime()) ? null : data;
  }
  if (typeof valor?.seconds === "number") return new Date(valor.seconds * 1000);
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function millisAviso(valor) {
  const data = normalizarDataAviso(valor);
  return data ? data.getTime() : null;
}

function avisoEmExposicao(aviso, agora = Date.now()) {
  const inicio = millisAviso(aviso?.inicioEm);
  const fim = millisAviso(aviso?.fimEm);
  return (inicio === null || inicio <= agora) && (fim === null || fim >= agora);
}

function normalizarAviso(id, dados = {}) {
  const perfis = normalizarListaAviso(dados.perfis);
  const usuarios = normalizarListaAviso(dados.usuarios).map(normalizarEmail).filter(Boolean);
  return {
    id,
    titulo: normalizarTextoAviso(dados.titulo),
    mensagem: normalizarTextoAviso(dados.mensagem),
    publico: dados.publico === true,
    perfis,
    perfisRegra: normalizarListaAviso(dados.perfisRegra || criarPerfisRegraAviso(perfis)),
    perfisBusca: normalizarListaAviso(dados.perfisBusca || perfis.map(normalizarPerfilAviso)),
    usuarios,
    autorEmail: normalizarEmail(dados.autorEmail),
    autorNome: dados.autorNome || "",
    inicioEm: dados.inicioEm || null,
    fimEm: dados.fimEm || null,
    ativo: dados.ativo !== false,
    criadoEm: dados.criadoEm || null,
    atualizadoEm: dados.atualizadoEm || null
  };
}

function avisoTimestamp(aviso) {
  const data = aviso?.inicioEm || aviso?.criadoEm || aviso?.atualizadoEm;
  if (data?.toMillis) return data.toMillis();
  if (typeof data?.seconds === "number") return data.seconds * 1000;
  return 0;
}

function ordenarAvisos(lista, { somenteEmExposicao = false } = {}) {
  return lista
    .filter((aviso) => aviso.ativo !== false)
    .filter((aviso) => !somenteEmExposicao || avisoEmExposicao(aviso))
    .sort((a, b) => avisoTimestamp(b) - avisoTimestamp(a));
}

function adicionarAvisosDoSnap(destino, snap) {
  snap.forEach((item) => {
    destino.set(item.id, normalizarAviso(item.id, item.data()));
  });
}

export async function listarAvisosFirestore({ email = "", perfil = "", gestor = false } = {}) {
  const avisos = new Map();
  const col = collection(db, COLECAO_AVISOS);

  if (gestor) {
    adicionarAvisosDoSnap(avisos, await getDocs(col));
    return ordenarAvisos([...avisos.values()]);
  }

  const emailUsuario = normalizarEmail(email);
  const perfilRegra = String(perfil || "").trim();
  const consultas = [
    getDocs(query(col, where("publico", "==", true)))
  ];

  if (emailUsuario) {
    consultas.push(getDocs(query(col, where("usuarios", "array-contains", emailUsuario))));
  }
  if (perfilRegra) {
    consultas.push(getDocs(query(col, where("perfisRegra", "array-contains", perfilRegra))));
  }

  const resultados = await Promise.allSettled(consultas);
  resultados.forEach((resultado) => {
    if (resultado.status === "fulfilled") adicionarAvisosDoSnap(avisos, resultado.value);
  });
  return ordenarAvisos([...avisos.values()], { somenteEmExposicao: true });
}

export async function salvarAvisoFirestore(aviso) {
  const titulo = normalizarTextoAviso(aviso?.titulo);
  const mensagem = normalizarTextoAviso(aviso?.mensagem);
  if (!titulo || !mensagem) throw new Error("Informe titulo e mensagem do aviso.");
  const inicioEm = normalizarDataAviso(aviso?.inicioEm);
  const fimEm = normalizarDataAviso(aviso?.fimEm);
  if (!inicioEm || !fimEm) throw new Error("Informe inicio e fim de exposicao do aviso.");
  if (fimEm.getTime() <= inicioEm.getTime()) throw new Error("O fim da exposicao deve ser depois do inicio.");

  const id = aviso?.id || "aviso_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const perfis = normalizarListaAviso(aviso?.perfis);
  const perfisRegra = criarPerfisRegraAviso(perfis);
  const usuarios = normalizarListaAviso(aviso?.usuarios).map(normalizarEmail).filter(Boolean);
  const payload = {
    titulo,
    mensagem,
    publico: aviso?.publico === true,
    perfis,
    perfisRegra,
    perfisBusca: perfis.map(normalizarPerfilAviso),
    usuarios,
    inicioEm,
    fimEm,
    autorEmail: normalizarEmail(aviso?.autorEmail),
    autorNome: aviso?.autorNome || "",
    ativo: aviso?.ativo !== false,
    atualizadoEm: serverTimestamp()
  };

  if (!aviso?.id) payload.criadoEm = serverTimestamp();
  await setDoc(doc(db, COLECAO_AVISOS, id), payload, { merge: true });
  return { id, ...payload };
}

export async function excluirAvisoFirestore(id) {
  const avisoId = String(id || "").trim();
  if (!avisoId) throw new Error("Aviso invalido.");
  await deleteDoc(doc(db, COLECAO_AVISOS, avisoId));
}
