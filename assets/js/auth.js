import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, buscarUsuarioFirestore, normalizarCadastro } from "./portal-firestore.js";
import { usuarios } from "./usuarios.js";

const auth = getAuth(app);

function portalPath(file) {
  const inPages = window.location.pathname.includes("/pages/");
  return inPages ? "../" + file : file;
}

async function getCadastro(user) {
  const email = String(user.email || "").toLowerCase();

  try {
    const cadastroOnline = await buscarUsuarioFirestore(email);
    if (cadastroOnline) {
      return {
        nome: cadastroOnline.nome || user.displayName || email,
        perfil: cadastroOnline.perfil || "Usuario"
      };
    }
  } catch (error) {
    console.warn("Nao foi possivel buscar usuario no Firestore:", error);
  }

  const cadastroLocal = usuarios[email] || usuarios[user.email];
  if (!cadastroLocal) {
    return {
      nome: user.displayName || user.email,
      perfil: "Usuario"
    };
  }

  const cadastro = normalizarCadastro(cadastroLocal, email);
  return {
    nome: cadastro.nome || user.displayName || email,
    perfil: cadastro.perfil || "Usuario"
  };
}

window.logout = function () {
  signOut(auth).finally(() => {
    window.location.href = portalPath("login.html");
  });
};

window.recuperarSenha = function (email) {
  return sendPasswordResetEmail(auth, email);
};

function isAdministrador(cadastro) {
  const perfil = String(cadastro.perfil || "").toLowerCase();
  return perfil === "administrador" || perfil === "gerencia";
}

function temAcessoTotal(cadastro) {
  const perfil = String(cadastro.perfil || "").toLowerCase();
  return isAdministrador(cadastro) || perfil === "secretária" || perfil === "secretaria";
}

function listaAtributo(valor) {
  return String(valor || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function usuarioPodeVer(el, cadastro) {
  const perfil = String(cadastro.perfil || "Usuario").toLowerCase();
  const email = String(cadastro.email || "").toLowerCase();
  const perfisBloqueados = listaAtributo(el.dataset.excluirPerfis);
  if (perfisBloqueados.includes(perfil)) return false;

  if (temAcessoTotal(cadastro)) return true;

  const perfisPermitidos = listaAtributo(el.dataset.perfis);
  const usuariosPermitidos = listaAtributo(el.dataset.usuarios);

  const temRegraPerfil = perfisPermitidos.length > 0;
  const temRegraUsuario = usuariosPermitidos.length > 0;

  if (!temRegraPerfil && !temRegraUsuario) return true;

  return perfisPermitidos.includes(perfil) || usuariosPermitidos.includes(email);
}

function aplicarPermissoes(cadastro) {
  const admin = isAdministrador(cadastro);
  document.documentElement.dataset.perfil = cadastro.perfil || "Usuario";
  window.portalUsuario = {
    nome: cadastro.nome,
    perfil: cadastro.perfil,
    email: cadastro.email,
    isAdmin: admin
  };

  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = admin ? "flex" : "none";
  });

  document.querySelectorAll("[data-perfis], [data-usuarios]").forEach((el) => {
    el.style.display = usuarioPodeVer(el, cadastro) ? "" : "none";
  });

  if (document.body?.dataset.requireAdmin === "true" && !admin) {
    const conteudo = document.getElementById("adminConteudo");
    const negado = document.getElementById("adminNegado");
    if (conteudo) conteudo.style.display = "none";
    if (negado) negado.style.display = "block";
  }

  const perfilAtual = String(cadastro.perfil || "Usuario").toLowerCase();
  const perfisBloqueadosPagina = listaAtributo(document.body?.dataset.excluirPerfis);
  if (perfisBloqueadosPagina.includes(perfilAtual)) {
    window.location.href = portalPath("index.html");
    return;
  }

  const perfisObrigatorios = listaAtributo(document.body?.dataset.requirePerfis);
  if (perfisObrigatorios.length && !temAcessoTotal(cadastro)) {
    if (!perfisObrigatorios.includes(perfilAtual)) {
      window.location.href = portalPath("index.html");
    }
  }
}

onAuthStateChanged(auth, async (user) => {
  const pagina = window.location.pathname.toLowerCase();

  if (!user) {
    if (!pagina.endsWith("/login.html") && !pagina.endsWith("login.html")) {
      window.location.href = portalPath("login.html");
    }
    return;
  }

  const cadastro = { ...await getCadastro(user), email: user.email };
  const nome = document.getElementById("usuarioLogado");
  const perfil = document.getElementById("perfilUsuario");

  if (nome) nome.textContent = cadastro.nome;
  if (perfil) perfil.textContent = cadastro.perfil;
  aplicarPermissoes(cadastro);
});
