import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, buscarUsuarioFirestore, normalizarCadastro } from "./portal-firestore.js";
import { usuarios } from "./usuarios.js";

const auth = getAuth(app);
const authReady = setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.warn("Nao foi possivel ajustar a sessao do portal:", error);
});

const LOADING_ID = "portalLoadingOverlay";
const AUTH_PENDING_CLASS = "portal-auth-pending";

function bloquearHtmlAteValidar() {
  document.documentElement.classList.add(AUTH_PENDING_CLASS);
  if (document.getElementById("portalAuthPendingStyle")) return;
  const style = document.createElement("style");
  style.id = "portalAuthPendingStyle";
  style.textContent = `
    .${AUTH_PENDING_CLASS} body > :not(#portalLoadingOverlay) {
      visibility: hidden !important;
    }
  `;
  document.head.appendChild(style);
}

function liberarHtmlValidado() {
  document.documentElement.classList.remove(AUTH_PENDING_CLASS);
}

bloquearHtmlAteValidar();
const loadingExternoMostrar = typeof window.portalMostrarCarregando === "function"
  ? window.portalMostrarCarregando.bind(window)
  : null;
const loadingExternoOcultar = typeof window.portalOcultarCarregando === "function"
  ? window.portalOcultarCarregando.bind(window)
  : null;
const loadingGlobalDisponivel = Boolean(loadingExternoMostrar && loadingExternoOcultar);

function mostrarCarregando(texto = "Carregando portal") {
  if (loadingGlobalDisponivel) {
    loadingExternoMostrar(texto);
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
    loadingExternoOcultar();
    return;
  }
  const overlay = document.getElementById(LOADING_ID);
  if (!overlay) return;
  overlay.classList.add("hide");
  window.setTimeout(() => overlay.remove(), 280);
}

if (!loadingGlobalDisponivel) {
  window.portalMostrarCarregando = mostrarCarregando;
  window.portalOcultarCarregando = ocultarCarregando;
}

if (document.body) {
  mostrarCarregando();
} else {
  document.addEventListener("DOMContentLoaded", () => mostrarCarregando(), { once: true });
}

function comTempoLimite(promise, ms, mensagem) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error(mensagem)), ms))
  ]);
}

function portalPath(file) {
  const inPages = window.location.pathname.includes("/pages/");
  return inPages ? "../" + file : file;
}

async function getCadastro(user) {
  const email = String(user.email || "").toLowerCase();
  const cached = lerCadastroCache(email);
  if (cached) {
    atualizarCadastroCache(email, user).catch(() => {});
    return cached;
  }

  try {
    const cadastroOnline = await comTempoLimite(buscarUsuarioFirestore(email), 8000, "Tempo esgotado ao buscar perfil no Firestore.");
    if (cadastroOnline) {
      const cadastro = {
        email,
        nome: cadastroOnline.nome || user.displayName || email,
        perfil: cadastroOnline.perfil || "Usuario",
        registro: cadastroOnline.registro || "",
        cargo: cadastroOnline.cargo || "",
        ativo: cadastroOnline.ativo !== false
      };
      salvarCadastroCache(email, cadastro);
      return cadastro;
    }
  } catch (error) {
    console.warn("Nao foi possivel buscar usuario no Firestore:", error);
  }

  const cadastroLocal = usuarios[email] || usuarios[user.email];
  if (!cadastroLocal) {
    const padrao = {
      email,
      nome: user.displayName || user.email,
      perfil: "Usuario",
      registro: "",
      cargo: "",
      ativo: true
    };
    salvarCadastroCache(email, padrao);
    return padrao;
  }

  const cadastro = normalizarCadastro(cadastroLocal, email);
  const resultado = {
    email: cadastro.email || email,
    nome: cadastro.nome || user.displayName || email,
    perfil: cadastro.perfil || "Usuario",
    registro: cadastro.registro || "",
    cargo: cadastro.cargo || "",
    ativo: cadastro.ativo !== false
  };
  salvarCadastroCache(email, resultado);
  return resultado;
}

const CADASTRO_CACHE_KEY = "portal_cadastro_v1";
const CADASTRO_CACHE_TTL_MS = 8 * 60 * 60 * 1000;

function lerCadastroCache(email) {
  try {
    const raw = sessionStorage.getItem(CADASTRO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email || parsed.email !== email || !parsed?.cadastro || !parsed?.ts) return null;
    if (Date.now() - parsed.ts > CADASTRO_CACHE_TTL_MS) return null;
    return parsed.cadastro;
  } catch (_) {
    return null;
  }
}

function salvarCadastroCache(email, cadastro) {
  try {
    sessionStorage.setItem(CADASTRO_CACHE_KEY, JSON.stringify({
      email,
      cadastro,
      ts: Date.now()
    }));
  } catch (_) {}
}

async function atualizarCadastroCache(email, user) {
  try {
    const cadastroOnline = await comTempoLimite(buscarUsuarioFirestore(email), 8000, "Tempo esgotado ao buscar perfil no Firestore.");
    if (cadastroOnline) {
      salvarCadastroCache(email, {
        email,
        nome: cadastroOnline.nome || user.displayName || email,
        perfil: cadastroOnline.perfil || "Usuario",
        registro: cadastroOnline.registro || "",
        cargo: cadastroOnline.cargo || "",
        ativo: cadastroOnline.ativo !== false
      });
    }
  } catch (_) {}
}

window.logout = function () {
  try { sessionStorage.removeItem(CADASTRO_CACHE_KEY); } catch (_) {}
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

  try {
    const credencial = EmailAuthProvider.credential(user.email, senhaAtual);
    await reauthenticateWithCredential(user, credencial);
    await updatePassword(user, novaSenha);
  } catch (error) {
    const traduzir = typeof window.portalMensagemErroSenha === "function"
      ? window.portalMensagemErroSenha
      : null;
    const mensagem = traduzir ? traduzir(error) : (error.message || String(error));
    const err = new Error(mensagem);
    err.code = error.code;
    throw err;
  }
};

function normalizarPerfil(perfil) {
  return String(perfil || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isAdministrador(cadastro) {
  return normalizarPerfil(cadastro?.perfil) === "administrador";
}

function listaAtributo(valor) {
  return String(valor || "")
    .split(",")
    .map((item) => normalizarPerfil(item))
    .filter(Boolean);
}

function listaEmails(valor) {
  return String(valor || "")
    .split(",")
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

function usuarioPodeVer(el, cadastro) {
  const perfil = normalizarPerfil(cadastro.perfil || "Usuario");
  const email = String(cadastro.email || "").toLowerCase();
  const perfisBloqueados = listaAtributo(el.dataset.excluirPerfis);
  if (perfisBloqueados.includes(perfil)) return false;

  if (isAdministrador(cadastro)) return true;

  const perfisPermitidos = listaAtributo(el.dataset.perfis);
  const usuariosPermitidos = listaEmails(el.dataset.usuarios);

  const temRegraPerfil = perfisPermitidos.length > 0;
  const temRegraUsuario = usuariosPermitidos.length > 0;

  if (!temRegraPerfil && !temRegraUsuario) return true;

  return perfisPermitidos.includes(perfil) || usuariosPermitidos.includes(email);
}

window.portalAguardarUsuario = function (callback) {
  if (typeof callback !== "function") return;
  if (window.portalUsuarioValidado) {
    callback(window.portalUsuario);
    return;
  }
  window.addEventListener("portal:usuario-validado", () => callback(window.portalUsuario), { once: true });
};

function aplicarPermissoes(cadastro) {
  const admin = isAdministrador(cadastro);
  document.documentElement.dataset.perfil = cadastro.perfil || "Usuario";
  window.portalUsuario = {
    nome: cadastro.nome,
    perfil: cadastro.perfil,
    email: cadastro.email,
    registro: cadastro.registro || "",
    cargo: cadastro.cargo || "",
    isAdmin: admin
  };

  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = admin ? "flex" : "none";
  });

  document.querySelectorAll("[data-perfis], [data-usuarios]").forEach((el) => {
    el.style.display = usuarioPodeVer(el, cadastro) ? "flex" : "none";
  });

  if (document.body?.dataset.requireAdmin === "true" && !admin) {
    const conteudo = document.getElementById("adminConteudo");
    const negado = document.getElementById("adminNegado");
    if (conteudo) conteudo.style.display = "none";
    if (negado) negado.style.display = "block";
  }

  const perfilAtual = normalizarPerfil(cadastro.perfil || "Usuario");
  const perfisBloqueadosPagina = listaAtributo(document.body?.dataset.excluirPerfis);
  if (perfisBloqueadosPagina.includes(perfilAtual)) {
    window.location.href = portalPath("index.html");
    return false;
  }

  const perfisObrigatorios = listaAtributo(document.body?.dataset.requirePerfis);
  const usuariosObrigatorios = listaEmails(document.body?.dataset.requireUsuarios);
  if ((perfisObrigatorios.length || usuariosObrigatorios.length) && !isAdministrador(cadastro)) {
    const email = String(cadastro.email || "").toLowerCase();
    const permitido = perfisObrigatorios.includes(perfilAtual) || usuariosObrigatorios.includes(email);
    if (!permitido) {
      window.location.href = portalPath("index.html");
      return false;
    }
  }
  return true;
}

authReady.finally(() => onAuthStateChanged(auth, async (user) => {
  const pagina = window.location.pathname.toLowerCase();

  try {
    if (!user) {
      if (!pagina.endsWith("/login.html") && !pagina.endsWith("login.html")) {
        window.location.href = portalPath("login.html");
      } else {
        liberarHtmlValidado();
        ocultarCarregando();
      }
      return;
    }

    const cadastro = { ...await getCadastro(user), email: String(user.email || "").toLowerCase() };

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
      window.portalUsuarioValidado = true;
      liberarHtmlValidado();
      ocultarCarregando();
      window.dispatchEvent(new CustomEvent("portal:usuario-validado", { detail: window.portalUsuario }));
    }
  } catch (error) {
    console.error("Erro ao validar usuario:", error);
    alert("Nao foi possivel validar seu acesso. Entre novamente no portal.");
    await signOut(auth).catch(() => {});
    liberarHtmlValidado();
    ocultarCarregando();
    window.location.href = portalPath("login.html");
  }
}));
