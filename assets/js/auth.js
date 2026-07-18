import {
  getAuth,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app, buscarUsuarioFirestore, normalizarCadastro } from "./portal-firestore.js";
import { usuarios } from "./usuarios.js";
import { aplicarSaudacaoHero } from "./portal-saudacao.js?v=20260704a";

const auth = getAuth(app);

function isPortalNativeEmbedded() {
  if (new URLSearchParams(window.location.search).get("embed") === "native-app") return true;
  try {
    if (window.self !== window.top && window.parent.document.documentElement.classList.contains("native-app")) {
      return true;
    }
  } catch (_) {}
  return document.documentElement.classList.contains("native-embedded");
}

const PORTAL_NATIVE_EMBEDDED = isPortalNativeEmbedded();

const authReady = setPersistence(
  auth,
  PORTAL_NATIVE_EMBEDDED ? browserLocalPersistence : browserSessionPersistence
).catch((error) => {
  console.warn("Nao foi possivel ajustar a sessao do portal:", error);
});

const LOADING_ID = "portalLoadingOverlay";
const AUTH_PENDING_CLASS = "portal-auth-pending";
let portalCarregamentoEncerrado = false;

function bloquearHtmlAteValidar() {
  document.documentElement.classList.add(AUTH_PENDING_CLASS);
  if (document.getElementById("portalAuthPendingStyle")) return;
  const style = document.createElement("style");
  style.id = "portalAuthPendingStyle";
  style.textContent = `
    .${AUTH_PENDING_CLASS} body > :not(#portalLoadingOverlay) {
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

function liberarHtmlValidado() {
  document.documentElement.classList.remove(AUTH_PENDING_CLASS);
}

if (!PORTAL_NATIVE_EMBEDDED) {
  bloquearHtmlAteValidar();
}
const loadingExternoMostrar = typeof window.portalMostrarCarregando === "function"
  ? window.portalMostrarCarregando.bind(window)
  : null;
const loadingExternoOcultar = typeof window.portalOcultarCarregando === "function"
  ? window.portalOcultarCarregando.bind(window)
  : null;
const loadingGlobalDisponivel = Boolean(loadingExternoMostrar && loadingExternoOcultar);

function mostrarCarregando(texto = "Carregando portal") {
  if (PORTAL_NATIVE_EMBEDDED) return;
  if (portalCarregamentoEncerrado) return;
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

  let style = document.getElementById("portalLoadingStyle");
  if (!style) {
    style = document.createElement("style");
    style.id = "portalLoadingStyle";
    document.head.appendChild(style);
  }
  style.textContent = `
    .portal-loading-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(6,20,50,.32);backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);transition:opacity .28s ease,visibility .28s ease;overflow:hidden}
    .portal-loading-overlay::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 60% 45% at 50% 40%,rgba(11,58,138,.18),transparent 70%)}
    .portal-loading-overlay::after{content:"";position:absolute;left:0;right:0;height:22%;top:-22%;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(255,107,0,.08),transparent);animation:portalScan 3.4s ease-in-out infinite}
    .portal-loading-overlay.hide{opacity:0;visibility:hidden;pointer-events:none}
    .portal-loading-box{position:relative;z-index:1;width:min(520px,94vw);min-height:340px;padding:44px 40px 36px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;border-radius:28px;border:1px solid rgba(255,255,255,.5);background:rgba(255,255,255,.28);backdrop-filter:blur(28px) saturate(200%);-webkit-backdrop-filter:blur(28px) saturate(200%);box-shadow:0 28px 70px -22px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -1px 0 rgba(255,255,255,.1);color:#f5f7fb;font-family:"SF Pro Display","Segoe UI",system-ui,-apple-system,sans-serif;overflow:hidden}
    .portal-loading-box::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(145deg,rgba(255,255,255,.35) 0%,transparent 42%,transparent 58%,rgba(255,107,0,.1) 100%)}
    .portal-loading-brand{position:relative;z-index:1;font-size:13px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.8)}
    .portal-loading-brand span{color:#ff8a3d}
    .portal-loading-mark{position:relative;z-index:1;width:124px;height:124px;display:grid;place-items:center;margin:4px 0}
    .portal-loading-ring,.portal-loading-ring-2{position:absolute;inset:0;border-radius:50%;border:2px solid transparent}
    .portal-loading-ring{border-top-color:rgba(255,255,255,.9);border-right-color:rgba(10,132,255,.75);animation:portalSpin 1.1s linear infinite;filter:drop-shadow(0 0 10px rgba(10,132,255,.5))}
    .portal-loading-ring-2{inset:14px;border-bottom-color:#ff6b00;border-left-color:rgba(255,107,0,.55);animation:portalSpin 1.7s linear infinite reverse;filter:drop-shadow(0 0 8px rgba(255,107,0,.45))}
    .portal-loading-core{width:72px;height:72px;border-radius:20px;display:grid;place-items:center;background:rgba(6,36,92,.5);border:1px solid rgba(255,255,255,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 10px 24px rgba(0,0,0,.28)}
    .portal-loading-core svg{width:40px;height:40px;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    .portal-loading-title{position:relative;z-index:1;margin:0;font-size:20px;font-weight:700;letter-spacing:.01em;color:#fff;text-shadow:0 1px 10px rgba(0,0,0,.3);max-width:100%;line-height:1.3}
    .portal-loading-sub{position:relative;z-index:1;margin:-2px 0 0;font-size:13px;font-weight:500;letter-spacing:.05em;color:rgba(255,255,255,.75)}
    .portal-loading-bar{position:relative;z-index:1;width:78%;height:4px;margin-top:8px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.18)}
    .portal-loading-bar>i{display:block;width:42%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#0a84ff,#ff6b00);animation:portalBar 1.35s ease-in-out infinite;box-shadow:0 0 14px rgba(255,107,0,.55)}
    @keyframes portalSpin{to{transform:rotate(360deg)}}
    @keyframes portalBar{0%{transform:translateX(-120%)}100%{transform:translateX(280%)}}
    @keyframes portalScan{0%{transform:translateY(0);opacity:0}15%{opacity:.8}85%{opacity:.45}100%{transform:translateY(480%);opacity:0}}
  `;

  const overlay = document.createElement("div");
  overlay.id = LOADING_ID;
  overlay.className = "portal-loading-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="portal-loading-box">
      <div class="portal-loading-brand">Portal <span>CIOP</span></div>
      <div class="portal-loading-mark" aria-hidden="true">
        <span class="portal-loading-ring"></span>
        <span class="portal-loading-ring-2"></span>
        <div class="portal-loading-core">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 15V8.5A3.5 3.5 0 0 1 7.5 5h9A3.5 3.5 0 0 1 20 8.5V15"/>
            <path d="M3 15h18v2.5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 17.5V15z"/>
            <circle cx="7.5" cy="18.5" r="1.4"/>
            <circle cx="16.5" cy="18.5" r="1.4"/>
            <path d="M7 9h10M7 12h4"/>
          </svg>
        </div>
      </div>
      <p class="portal-loading-title">${texto}</p>
      <p class="portal-loading-sub">Monitoramento em tempo real</p>
      <div class="portal-loading-bar" aria-hidden="true"><i></i></div>
    </div>`;
  document.body.appendChild(overlay);
}

function ocultarCarregando() {
  portalCarregamentoEncerrado = true;
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

if (!PORTAL_NATIVE_EMBEDDED) {
  if (document.body) {
    mostrarCarregando();
  } else {
    document.addEventListener("DOMContentLoaded", () => mostrarCarregando(), { once: true });
  }
} else {
  liberarHtmlValidado();
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

function negarAcessoPagina() {
  if (PORTAL_NATIVE_EMBEDDED) {
    liberarHtmlValidado();
    ocultarCarregando();
    const main = document.querySelector(".shell") || document.body;
    const aviso = document.createElement("div");
    aviso.className = "empty";
    aviso.innerHTML = "<h3>Acesso restrito</h3><p>Seu usuário não tem permissão para este módulo no app.</p>";
    main.prepend(aviso);
    return false;
  }
  window.location.href = portalPath("index.html");
  return false;
}

function modernizarSessaoUsuario() {
  const session = document.querySelector(".ciop-session");
  if (!session) return;

  const userEl = session.querySelector(".ciop-session-user, #usuarioLogado");
  const cargoEl = session.querySelector(".ciop-session-cargo, .ciop-session-profile, #perfilUsuario");
  if (!userEl) return;

  let info = session.querySelector(".ciop-session-info");
  if (!info) {
    info = document.createElement("div");
    info.className = "ciop-session-info";
    session.insertBefore(info, userEl);
    info.appendChild(userEl);
    if (cargoEl) info.appendChild(cargoEl);
  }

  session.querySelector(".ciop-session-avatar")?.remove();

  let actions = session.querySelector(".ciop-session-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "ciop-session-actions";
    session.appendChild(actions);
  }

  session.querySelectorAll(".btn-senha-portal, .btn-logout:not(.btn-senha-portal)").forEach((btn) => {
    if (btn.parentElement !== actions) actions.appendChild(btn);
  });

  session.classList.add("ciop-session-modern");
}

window.modernizarSessaoUsuario = modernizarSessaoUsuario;

function atualizarSaudacaoHero(cadastroOuNome) {
  const nome = typeof cadastroOuNome === "string" ? cadastroOuNome : cadastroOuNome?.nome;
  const genero = typeof cadastroOuNome === "object" ? cadastroOuNome?.genero : "";
  aplicarSaudacaoHero(nome, { genero });
}

const PORTAL_SESSION_CSS_V = "20260718g";

function garantirCssSessao() {
  const href = portalPath(`assets/css/portal-session.css?v=${PORTAL_SESSION_CSS_V}`);
  const existing = document.querySelector('link[href*="portal-session.css"]');
  if (existing) {
    existing.dataset.portalSession = "1";
    if (!String(existing.getAttribute("href") || "").includes(`v=${PORTAL_SESSION_CSS_V}`)) {
      existing.href = href;
    }
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.portalSession = "1";
  document.head.appendChild(link);
}

function garantirCssMarca() {
  if (document.querySelector("link[data-portal-brand]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-brand.css");
  link.dataset.portalBrand = "1";
  document.head.appendChild(link);
}

function garantirCssHeader() {
  if (document.querySelector("link[data-portal-header]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-header.css");
  link.dataset.portalHeader = "1";
  document.head.appendChild(link);
}

function notificarPortalPronto() {
  window.dispatchEvent(new CustomEvent("portal:usuario-validado", { detail: window.portalUsuario }));
  if (typeof window.iniciarAvisosPortal === "function") {
    window.iniciarAvisosPortal();
  }
}

function garantirMarcaPortal() {
  if (document.querySelector("script[data-portal-brand-js]")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/portal-brand.js");
  script.defer = true;
  script.dataset.portalBrandJs = "1";
  script.onload = () => {
    if (typeof window.modernizarMarcaPortal === "function") {
      window.modernizarMarcaPortal();
    }
  };
  document.head.appendChild(script);
}

garantirCssSessao();
garantirCssMarca();
garantirCssHeader();
garantirMarcaPortal();

function garantirRodapePortal() {
  if (document.querySelector("script[data-portal-footer]")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/portal-footer.js");
  script.defer = true;
  script.dataset.portalFooter = "1";
  document.head.appendChild(script);
}

garantirRodapePortal();
window.addEventListener("portal:usuario-validado", modernizarSessaoUsuario);

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

  const usuariosPermitidos = listaEmails(el.dataset.usuarios);
  if (el.dataset.somenteUsuarios === "true" && usuariosPermitidos.length > 0) {
    return usuariosPermitidos.includes(email);
  }

  if (isAdministrador(cadastro)) return true;

  const perfisPermitidos = listaAtributo(el.dataset.perfis);

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
    genero: cadastro.genero || "",
    isAdmin: admin
  };

  atualizarSaudacaoHero(cadastro);
  modernizarSessaoUsuario();

  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = admin ? "flex" : "none";
  });

  document.querySelectorAll("[data-perfis], [data-usuarios]").forEach((el) => {
    const pode = usuarioPodeVer(el, cadastro);
    el.classList.toggle("portal-card-visivel", pode);
    el.hidden = !pode;
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
    return negarAcessoPagina();
  }

  const perfisObrigatorios = listaAtributo(document.body?.dataset.requirePerfis);
  const usuariosObrigatorios = listaEmails(document.body?.dataset.requireUsuarios);
  const email = String(cadastro.email || "").toLowerCase();
  if (document.body?.dataset.requireSomenteUsuarios === "true" && usuariosObrigatorios.length) {
    if (!usuariosObrigatorios.includes(email)) {
      return negarAcessoPagina();
    }
  } else if ((perfisObrigatorios.length || usuariosObrigatorios.length) && !isAdministrador(cadastro)) {
    const permitido = perfisObrigatorios.includes(perfilAtual) || usuariosObrigatorios.includes(email);
    if (!permitido) {
      return negarAcessoPagina();
    }
  }
  return true;
}

authReady.finally(() => onAuthStateChanged(auth, async (user) => {
  const pagina = window.location.pathname.toLowerCase();

  try {
    if (!user) {
      if (!pagina.endsWith("/login.html") && !pagina.endsWith("login.html")) {
        if (PORTAL_NATIVE_EMBEDDED) {
          return;
        }
        ocultarCarregando();
        window.location.href = portalPath("login.html");
      } else {
        liberarHtmlValidado();
        ocultarCarregando();
      }
      return;
    }

    if (PORTAL_NATIVE_EMBEDDED) liberarHtmlValidado();

    const cadastro = { ...await getCadastro(user), email: String(user.email || "").toLowerCase() };

    if (cadastro.ativo === false) {
      alert("Seu acesso ao portal esta desativado. Procure um administrador.");
      if (PORTAL_NATIVE_EMBEDDED) {
        liberarHtmlValidado();
        ocultarCarregando();
        return;
      }
      await signOut(auth);
      ocultarCarregando();
      window.location.href = portalPath("login.html");
      return;
    }

    const nome = document.getElementById("usuarioLogado");
    const cargoEl = document.getElementById("perfilUsuario");

    if (nome) nome.textContent = cadastro.nome || "";
    if (cargoEl) {
      const cargo = String(cadastro.cargo || "").trim();
      cargoEl.textContent = cargo;
      cargoEl.hidden = !cargo;
    }
    atualizarSaudacaoHero(cadastro);
    modernizarSessaoUsuario();
    if (aplicarPermissoes(cadastro) !== false) {
      window.portalUsuarioValidado = true;
      liberarHtmlValidado();
      ocultarCarregando();
      notificarPortalPronto();
    } else {
      liberarHtmlValidado();
      ocultarCarregando();
    }
  } catch (error) {
    console.error("Erro ao validar usuario:", error);
    if (PORTAL_NATIVE_EMBEDDED) {
      liberarHtmlValidado();
      ocultarCarregando();
      alert("Não foi possível validar seu acesso neste módulo. Volte ao Início e tente novamente.");
      return;
    }
    alert("Nao foi possivel validar seu acesso. Entre novamente no portal.");
    await signOut(auth).catch(() => {});
    liberarHtmlValidado();
    ocultarCarregando();
    window.location.href = portalPath("login.html");
  }
}));
