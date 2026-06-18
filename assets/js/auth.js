import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, buscarUsuarioFirestore, normalizarCadastro } from "./portal-firestore.js";
import { usuarios } from "./usuarios.js";

const auth = getAuth(app);

const LOADING_ID = "portalLoadingOverlay";
const loadingGlobalDisponivel = typeof window.portalMostrarCarregando === "function";

function mostrarCarregando(texto = "Carregando portal") {
  if (loadingGlobalDisponivel) {
    window.portalMostrarCarregando(texto);
    return;
  }
  const existente = document.getElementById(LOADING_ID);
  if (existente) {
    const titulo = existente.querySelector(".portal-loading-title");
    if (titulo) titulo.textContent = texto;
    existente.classList.remove("hide");
    return;
  }

  const style = document.createElement("style");
  style.id = "portalLoadingStyle";
  style.textContent = `
    .portal-loading-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(245,247,251,.96),rgba(232,237,246,.96));backdrop-filter:blur(8px);transition:opacity .25s ease,visibility .25s ease}
    .portal-loading-overlay.hide{opacity:0;visibility:hidden}
    .portal-loading-box{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 28px;border:1px solid rgba(6,36,92,.12);border-radius:10px;background:rgba(255,255,255,.92);box-shadow:0 18px 50px rgba(16,24,40,.16);color:#06245c;font-family:Arial,Helvetica,sans-serif;min-width:220px}
    .portal-loading-mark{position:relative;width:54px;height:54px}
    .portal-loading-mark::before,.portal-loading-mark::after{content:"";position:absolute;inset:0;border-radius:50%;border:4px solid transparent}
    .portal-loading-mark::before{border-top-color:#06245c;border-right-color:#0b3a8a;animation:portalSpin .85s linear infinite}
    .portal-loading-mark::after{inset:9px;border-bottom-color:#ff6b00;border-left-color:#ff6b00;animation:portalSpin 1.15s linear infinite reverse}
    .portal-loading-title{font-size:15px;font-weight:800;letter-spacing:.2px}
    .portal-loading-dots{display:flex;gap:5px}
    .portal-loading-dots span{width:6px;height:6px;border-radius:50%;background:#ff6b00;animation:portalPulse 1s ease-in-out infinite}
    .portal-loading-dots span:nth-child(2){animation-delay:.15s}.portal-loading-dots span:nth-child(3){animation-delay:.3s}
    @keyframes portalSpin{to{transform:rotate(360deg)}}
    @keyframes portalPulse{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = LOADING_ID;
  overlay.className = "portal-loading-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="portal-loading-box">
      <div class="portal-loading-mark" aria-hidden="true"></div>
      <div class="portal-loading-title">${texto}</div>
      <div class="portal-loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>
    </div>`;
  document.body.appendChild(overlay);
}

function ocultarCarregando() {
  if (loadingGlobalDisponivel) {
    window.portalOcultarCarregando?.();
    return;
  }
  const overlay = document.getElementById(LOADING_ID);
  if (!overlay) return;
  overlay.classList.add("hide");
  window.setTimeout(() => overlay.remove(), 280);
}

window.portalMostrarCarregando = mostrarCarregando;
window.portalOcultarCarregando = ocultarCarregando;

if (document.body) {
  mostrarCarregando();
} else {
  document.addEventListener("DOMContentLoaded", () => mostrarCarregando(), { once: true });
}

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
        perfil: cadastroOnline.perfil || "Usuario",
        ativo: cadastroOnline.ativo !== false
      };
    }
  } catch (error) {
    console.warn("Nao foi possivel buscar usuario no Firestore:", error);
  }

  const cadastroLocal = usuarios[email] || usuarios[user.email];
  if (!cadastroLocal) {
    return {
      nome: user.displayName || user.email,
      perfil: "Usuario",
      ativo: true
    };
  }

  const cadastro = normalizarCadastro(cadastroLocal, email);
  return {
    nome: cadastro.nome || user.displayName || email,
    perfil: cadastro.perfil || "Usuario",
    ativo: cadastro.ativo !== false
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

window.alterarSenha = async function (senhaAtual, novaSenha) {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("Sessao expirada. Entre novamente no portal.");
  }
  if (!senhaAtual || !novaSenha) {
    throw new Error("Informe a senha atual e a nova senha.");
  }
  if (novaSenha.length < 6) {
    throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
  }

  const credencial = EmailAuthProvider.credential(user.email, senhaAtual);
  await reauthenticateWithCredential(user, credencial);
  await updatePassword(user, novaSenha);
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
    return false;
  }

  const perfisObrigatorios = listaAtributo(document.body?.dataset.requirePerfis);
  if (perfisObrigatorios.length && !temAcessoTotal(cadastro)) {
    if (!perfisObrigatorios.includes(perfilAtual)) {
      window.location.href = portalPath("index.html");
      return false;
    }
  }
  return true;
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

  if (cadastro.ativo === false) {
    alert("Seu acesso ao portal esta desativado. Procure um administrador.");
    await signOut(auth);
    window.location.href = portalPath("login.html");
    return;
  }

  const nome = document.getElementById("usuarioLogado");
  const perfil = document.getElementById("perfilUsuario");

  if (nome) nome.textContent = cadastro.nome;
  if (perfil) perfil.textContent = cadastro.perfil;
  if (aplicarPermissoes(cadastro) !== false) {
    ocultarCarregando();
  }
});
