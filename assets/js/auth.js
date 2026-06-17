import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { usuarios } from "./usuarios.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function portalPath(file) {
  const inPages = window.location.pathname.includes("/pages/");
  return inPages ? "../" + file : file;
}

function getCadastro(user) {
  const cadastro = usuarios[user.email] || usuarios[user.email?.toLowerCase()];
  if (!cadastro) {
    return {
      nome: user.displayName || user.email,
      perfil: "Usuario"
    };
  }
  if (typeof cadastro === "string") {
    return {
      nome: user.email,
      perfil: cadastro
    };
  }
  return {
    nome: cadastro.nome || user.displayName || user.email,
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
  return String(cadastro.perfil || "").toLowerCase() === "administrador";
}

function aplicarPermissoes(cadastro) {
  const admin = isAdministrador(cadastro);
  document.documentElement.dataset.perfil = cadastro.perfil || "Usuario";
  window.portalUsuario = {
    nome: cadastro.nome,
    perfil: cadastro.perfil,
    isAdmin: admin
  };

  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = admin ? "flex" : "none";
  });

  if (document.body?.dataset.requireAdmin === "true" && !admin) {
    const conteudo = document.getElementById("adminConteudo");
    const negado = document.getElementById("adminNegado");
    if (conteudo) conteudo.style.display = "none";
    if (negado) negado.style.display = "block";
  }
}

onAuthStateChanged(auth, (user) => {
  const pagina = window.location.pathname.toLowerCase();

  if (!user) {
    if (!pagina.endsWith("/login.html") && !pagina.endsWith("login.html")) {
      window.location.href = portalPath("login.html");
    }
    return;
  }

  const cadastro = getCadastro(user);
  const nome = document.getElementById("usuarioLogado");
  const perfil = document.getElementById("perfilUsuario");

  if (nome) nome.textContent = cadastro.nome;
  if (perfil) perfil.textContent = cadastro.perfil;
  aplicarPermissoes(cadastro);
});
