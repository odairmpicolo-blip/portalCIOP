import './portal-novidades.js?v=20261022intro1';
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
import { aplicarSaudacaoHero } from "./portal-saudacao.js?v=20261022home3";
import { carregarAcessosPerfis, usuarioTemModulo } from "./portal-perfis-acesso.js?v=20260901cartao";
import "./portal-mfa.js?v=20260820mfa";
import {
  iniciarHeartbeatPresenca,
  pararHeartbeatPresenca,
  marcarPresencaOffline
} from "./portal-presenca.js?v=20260817a";
import "./portal-dashboard-ui.js?v=20260820d7";
import { registrarAuditoria } from "./portal-auditoria.js?v=20261009audit";

if (/\/pages\/apresentacao-km(?:-coletiva)?\.html$/i.test(location.pathname)) {
  location.replace("https://apresentacao-km.invalid/");
  throw new Error("pagina removida");
}

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

function paginaEhPublica() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0].toLowerCase();
  return file === "performance-tempo-real.html" || file === "pontualidade-ao-vivo.html";
}

if (!PORTAL_NATIVE_EMBEDDED && !paginaEhPublica()) {
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
  const logoLight = new URL("../img/portal-logo-clean-light.png", import.meta.url).href;
  const logoDark = new URL("../img/portal-logo-clean-dark.png", import.meta.url).href;
  style.textContent = `
.portal-loading-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:20px;box-sizing:border-box;background:rgba(8,24,44,.16);backdrop-filter:blur(8px) saturate(115%);-webkit-backdrop-filter:blur(8px) saturate(115%);transition:opacity .28s ease,visibility .28s ease}
.portal-loading-overlay.hide{opacity:0;visibility:hidden;pointer-events:none}
.portal-loading-box{position:relative;isolation:isolate;overflow:hidden;box-sizing:border-box;width:min(390px,100%);padding:36px 30px 30px;border-radius:30px;border:1px solid rgba(255,255,255,.65);background:linear-gradient(145deg,rgba(255,255,255,.84),rgba(239,248,255,.68));box-shadow:0 24px 80px rgba(5,27,53,.2),inset 0 1px 0 #fff;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);text-align:center;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#143252}
.portal-loading-box::before{content:"";position:absolute;inset:0;z-index:-1;background:radial-gradient(ellipse at 20% 0,rgba(63,173,255,.14),transparent 65%),radial-gradient(ellipse at 100% 100%,rgba(255,133,51,.12),transparent 60%);pointer-events:none}
.portal-loading-art{position:relative;margin:0 auto 26px;width:min(260px,100%)}
.portal-loading-logo{display:block!important;width:100%!important;height:auto!important;max-height:120px!important;object-fit:contain!important;background:transparent!important;box-shadow:none!important;border:0!important}
.portal-loading-logo-dark{display:none!important}
.portal-loading-title{margin:0!important;color:#143252!important;-webkit-text-fill-color:#143252!important;font-size:19px!important;font-weight:650;line-height:1.4;letter-spacing:-.025em}
.portal-loading-sub{margin:8px 0 24px!important;color:#52677f!important;-webkit-text-fill-color:#52677f!important;font-size:13px!important;line-height:1.5}
.portal-loading-bar{height:3px;width:100%;overflow:hidden;border-radius:99px;background:rgba(21,66,110,.1)}
.portal-loading-bar>i{display:block;width:38%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#168ee0,#49bded,#ff872f);animation:portalLoadingGlide 1.8s cubic-bezier(.45,0,.3,1) infinite}
.portal-loading-caption{margin:14px 0 0;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#60758b}
.dk-dark .portal-loading-box{background:linear-gradient(145deg,rgba(20,46,72,.88),rgba(8,27,47,.75));border-color:rgba(221,241,255,.26);box-shadow:0 24px 80px rgba(0,9,22,.3),inset 0 1px 0 rgba(255,255,255,.16)}
.dk-dark .portal-loading-logo-light{display:none!important}.dk-dark .portal-loading-logo-dark{display:block!important}
.dk-dark .portal-loading-title{color:#f1f7ff!important;-webkit-text-fill-color:#f1f7ff!important}
.dk-dark .portal-loading-sub{color:#c1d1e2!important;-webkit-text-fill-color:#c1d1e2!important}
.dk-dark .portal-loading-caption{color:#a9bfd4}.dk-dark .portal-loading-bar{background:rgba(216,236,255,.14)}
@keyframes portalLoadingGlide{0%{transform:translateX(-105%)}100%{transform:translateX(365%)}}
@media(prefers-reduced-motion:reduce){.portal-loading-bar>i{animation:none;width:100%;opacity:.7}.portal-loading-overlay{transition:none}}
@media(max-width:420px){.portal-loading-box{padding:30px 24px 26px;border-radius:24px}}
`;
  const overlay = document.createElement("div");
  overlay.id = LOADING_ID;
  overlay.className = "portal-loading-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `<div class="portal-loading-box">
 <div class="portal-loading-art" aria-hidden="true">
  <img class="portal-loading-logo portal-loading-logo-light" src="${logoLight}" alt="" decoding="async" onerror="this.onerror=null;this.src=this.src.replace('portal-logo-clean-light.png','logomarca-portalciop-tcgl-claro.png')">
  <img class="portal-loading-logo portal-loading-logo-dark" src="${logoDark}" alt="" decoding="async" onerror="this.onerror=null;this.src=this.src.replace('portal-logo-clean-dark.png','logomarca-portalciop-tcgl-escuro.png')">
 </div>
 <p class="portal-loading-title"></p>
 <p class="portal-loading-sub">Só um instante. Estamos preparando tudo.</p>
 <div class="portal-loading-bar" aria-hidden="true"><i></i></div>
 <p class="portal-loading-caption">TCGL · Operações</p>
</div>`;
  overlay.querySelector(".portal-loading-title").textContent = texto;
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
  garantirSessaoPadrao();
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

function paginaEhHomePortal() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0];
  return file === "" || file === "index.html" || file === "login.html";
}

function garantirSessaoPadrao() {
  if (paginaEhHomePortal()) return;
  let session = document.querySelector(".ciop-session");
  if (!session) {
    const header = document.querySelector("header.header, .header");
    const actions = header?.querySelector(".header-actions") || header;
    if (!actions) return;
    session = document.createElement("div");
    session.className = "ciop-session";
    session.setAttribute("aria-label", "Sessão do usuário");
    session.innerHTML = '<span id="usuarioLogado" class="ciop-session-user">Usuário</span>'
      + '<span id="perfilUsuario" class="ciop-session-cargo" hidden></span>'
      + '<button type="button" class="btn-logout" onclick="logout()">Sair</button>';
    actions.appendChild(session);
  }
  if (!session.querySelector(".btn-logout, button[onclick*='logout']")) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn-logout";
    b.textContent = "Sair";
    b.addEventListener("click", () => window.logout?.());
    session.appendChild(b);
  }
}

const PORTAL_BTN_ICON = '<span class="btn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg></span>';

function linkEPortalHome(a) {
  if (!a || a.classList.contains("portal-brand-mark")) return false;
  const href = a.getAttribute("href") || "";
  if (!/index\.html/i.test(href)) return false;
  if (a.classList.contains("btn-portal") || a.classList.contains("portal-voltar-auto") || a.dataset.portalVoltar) return true;
  const rotulo = `${a.textContent || ""} ${a.getAttribute("aria-label") || ""}`;
  return /\bportal\b/i.test(rotulo);
}

function aplicarEstiloBotaoPortal(a) {
  a.classList.add("btn-portal");
  a.classList.remove("portal-voltar-auto");
  a.dataset.portalVoltar = "1";
  const icones = a.querySelectorAll(".btn-icon, svg");
  if (icones.length > 1) {
    icones.forEach((el, i) => { if (i > 0 && el.classList.contains("btn-icon")) el.remove(); });
  } else if (!a.querySelector(".btn-icon") && !a.querySelector("svg")) {
    a.insertAdjacentHTML("afterbegin", PORTAL_BTN_ICON);
  }
}

function padronizarBotoesPortal() {
  if (paginaEhHomePortal()) return;
  document.querySelectorAll("a[href]").forEach((a) => {
    if (linkEPortalHome(a)) aplicarEstiloBotaoPortal(a);
  });
}

function jaTemVoltarAoPortal() {
  if (document.querySelector(".portal-return, [data-portal-voltar], a.btn-portal[href*='index.html']")) {
    return true;
  }
  return [...document.querySelectorAll("a[href]")].some((a) => linkEPortalHome(a));
}

function garantirVoltarAoPortal() {
  if (PORTAL_NATIVE_EMBEDDED || paginaEhHomePortal()) return;
  padronizarBotoesPortal();
  if (jaTemVoltarAoPortal()) return;
  const header = document.querySelector(".header");
  if (!header) return;
  const alvo = header.querySelector(".header-actions") || header;
  const a = document.createElement("a");
  a.href = portalPath("index.html");
  a.className = "btn-portal";
  a.dataset.portalVoltar = "1";
  a.setAttribute("aria-label", "Voltar ao portal");
  a.innerHTML = `${PORTAL_BTN_ICON}Portal`;
  alvo.insertBefore(a, alvo.firstChild);
}

function atualizarSaudacaoHero(cadastroOuNome) {
  const nome = typeof cadastroOuNome === "string" ? cadastroOuNome : cadastroOuNome?.nome;
  const genero = typeof cadastroOuNome === "object" ? cadastroOuNome?.genero : "";
  aplicarSaudacaoHero(nome, { genero });
}

const PORTAL_SESSION_CSS_V = "20260818open";

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
  link.href = portalPath("assets/css/portal-brand.css?v=20260818head3");
  link.dataset.portalBrand = "1";
  document.head.appendChild(link);
}

function garantirCssHeader() {
  if (document.querySelector("link[data-portal-header]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-header.css?v=20260818head3");
  link.dataset.portalHeader = "1";
  document.head.appendChild(link);
}

function notificarPortalPronto() {
  window.dispatchEvent(new CustomEvent("portal:usuario-validado", { detail: window.portalUsuario }));
  if (typeof window.iniciarAvisosPortal === "function") {
    window.iniciarAvisosPortal();
  }
  const arquivo = (location.pathname.split("/").pop() || "index.html").split("?")[0];
  const acaoAudit = (!arquivo || arquivo === "index.html") ? "entrou" : "pagina";
  registrarAuditoria({ acao: acaoAudit }).catch(() => null);
}

function garantirMarcaPortal() {
  if (document.querySelector("script[data-portal-brand-js]")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/portal-brand.js?v=20260818logo6");
  script.defer = true;
  script.dataset.portalBrandJs = "1";
  script.onload = () => {
    if (typeof window.modernizarMarcaPortal === "function") {
      window.modernizarMarcaPortal();
    }
  };
  document.head.appendChild(script);
}

function garantirCssLiquidGlass() {
  if (document.querySelector("link[data-portal-liquid]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-liquid-glass.css?v=20260818p");
  link.dataset.portalLiquid = "1";
  document.head.appendChild(link);
}

function paginaSemWallpaperIos() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0];
  if (/^login\.html$/.test(file)) return true;
  if (document.body && document.body.classList.contains("login-v2")) return true;
  return false;
}

function garantirCssGlassDesktop() {
  if (document.querySelector("link[href*='portal-glass-desktop.css']")) return;
  if (paginaSemWallpaperIos()) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-glass-desktop.css?v=20261022ios27");
  link.dataset.portalGlassDesktop = "1";
  document.head.appendChild(link);
}

function garantirCssVisualUltimo() {
  if (paginaSemWallpaperIos()) return;
  let link = document.querySelector("link[href*='portal-visual.css']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = portalPath("assets/css/portal-visual.css?v=20261022home5");
    link.dataset.portalVisual = "1";
    document.head.appendChild(link);
    return;
  }
  document.head.appendChild(link);
}

function garantirWallpaperIos() {
  if (paginaSemWallpaperIos()) return;
  if (!document.body) return;
  if (document.querySelector(".bg-wall, .body-bg-wall")) return;
  const wall = document.createElement("div");
  wall.className = "body-bg-wall";
  wall.setAttribute("aria-hidden", "true");
  document.body.insertBefore(wall, document.body.firstChild);
}

function garantirThemeToggle() {
  if (document.querySelector("script[src*='theme-toggle.js']")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/theme-toggle.js?v=20261028audit2");
  document.head.appendChild(script);
}

function garantirNavIncidentes() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0];
  if (!/^incidentes-|^relatorio-ocorrencia\.html$/.test(file)) return;
  if (document.querySelector("script[data-portal-inc-nav]")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/incidentes-nav.js?v=20260820i8");
  script.defer = true;
  script.dataset.portalIncNav = "1";
  document.head.appendChild(script);
}

function garantirNavTempoReal() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0];
  if (!/^(onibus-agora|onibus-horarios|fleetbus-agora|terminais-agora)\.html$/.test(file)) return;
  if (document.querySelector("script[data-portal-live-nav]")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/tempo-real-nav.js?v=20260820t20");
  script.defer = true;
  script.dataset.portalLiveNav = "1";
  document.head.appendChild(script);
}

function garantirTempoRealPoll() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0];
  if (!/^(onibus-agora|onibus-agora-clever|onibus-horarios|fleetbus-agora|terminais-agora)\.html$/.test(file)) return;
  if (document.querySelector("script[data-portal-live-poll]")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/portal-tempo-real.js?v=20260820t20");
  script.dataset.portalLivePoll = "1";
  document.head.appendChild(script);
}

function garantirPwa() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0];
  if (/^painel-tv|^pontualidade-tempo-real\.html$/.test(file)) return;
  if (!document.querySelector("link[rel=\"manifest\"]")) {
    const man = document.createElement("link");
    man.rel = "manifest";
    man.href = portalPath("assets/pwa/manifest.webmanifest");
    document.head.appendChild(man);
  }
  if (!document.querySelector("meta[name=\"theme-color\"]")) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = "#06245c";
    document.head.appendChild(meta);
  }
  if (!document.querySelector("link[rel=\"icon\"], link[rel=\"shortcut icon\"]")) {
    const fav = document.createElement("link");
    fav.rel = "icon";
    fav.type = "image/png";
    fav.sizes = "32x32";
    fav.href = portalPath("assets/img/portal-favicon.png?v=20261026fav1");
    document.head.appendChild(fav);
  }
  if (!document.querySelector("link[rel=\"apple-touch-icon\"]")) {
    const icon = document.createElement("link");
    icon.rel = "apple-touch-icon";
    icon.href = portalPath("assets/img/portal-favicon-192.png?v=20261026fav1");
    document.head.appendChild(icon);
  }
}

function garantirNavRelatorios() {
  const file = (window.location.pathname.split("/").pop() || "").split("?")[0];
  if (!/^(relatorios|criar-relatorio|liberacao-relatorio|folha-servico-relatorio|relatorio-ocorrencia)\.html$/.test(file)) return;
  if (document.querySelector("script[data-portal-rel-nav]")) return;
  const script = document.createElement("script");
  script.src = portalPath("assets/js/relatorios-nav.js?v=20260820r9");
  script.defer = true;
  script.dataset.portalRelNav = "1";
  document.head.appendChild(script);
}

function garantirCssUi() {
  if (document.querySelector("link[data-portal-ui]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-ui.css?v=20261028audit1");
  link.dataset.portalUi = "1";
  document.head.appendChild(link);
}

garantirCssSessao();
garantirCssMarca();
garantirCssHeader();
garantirCssLiquidGlass();
garantirCssGlassDesktop();
garantirCssVisualUltimo();
garantirCssUi();
if (document.body) {
  garantirWallpaperIos();
} else {
  document.addEventListener("DOMContentLoaded", garantirWallpaperIos);
}
garantirThemeToggle();
garantirMarcaPortal();
garantirNavIncidentes();
garantirNavRelatorios();
garantirNavTempoReal();
garantirTempoRealPoll();
garantirPwa();

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
    return {
      email,
      nome: user.displayName || user.email,
      perfil: "Usuario",
      registro: "",
      cargo: "",
      ativo: false
    };
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
const CADASTRO_CACHE_TTL_MS = 30 * 60 * 1000;

function lerCadastroCache(email) {
  try {
    const raw = localStorage.getItem(CADASTRO_CACHE_KEY);
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
    localStorage.setItem(CADASTRO_CACHE_KEY, JSON.stringify({
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
  try { localStorage.removeItem(CADASTRO_CACHE_KEY); } catch (_) {}
  const email = window.portalUsuario?.email;
  pararHeartbeatPresenca();
  Promise.resolve(registrarAuditoria({ acao: "saiu" })).finally(() => {
    Promise.resolve(marcarPresencaOffline(email)).finally(() => {
      signOut(auth).finally(() => {
        window.location.href = portalPath("login.html");
      });
    });
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

  const moduloId = String(el.dataset.modulo || "").trim();
  if (moduloId) {
    const decisaoModulo = usuarioTemModulo(email, perfil, moduloId);
    if (decisaoModulo !== null) return decisaoModulo;
  }

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
  garantirVoltarAoPortal();
  padronizarBotoesPortal();

  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    el.style.display = admin ? "flex" : "none";
  });

  document.querySelectorAll("[data-perfis], [data-usuarios], [data-modulo]").forEach((el) => {
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

let cadastroAplicado = null;
window.addEventListener("portal:acessos-atualizados", () => {
  if (cadastroAplicado) aplicarPermissoes(cadastroAplicado);
});

authReady.finally(() => onAuthStateChanged(auth, async (user) => {
  const pagina = window.location.pathname.toLowerCase();

  try {
    if (!user) {
      if (paginaEhPublica()) {
        liberarHtmlValidado();
        ocultarCarregando();
        return;
      }
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

    const [cadastroBase] = await Promise.all([
      getCadastro(user),
      carregarAcessosPerfis().catch(() => null)
    ]);
    const cadastro = { ...cadastroBase, email: String(user.email || "").toLowerCase() };

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
    cadastroAplicado = cadastro;
    if (aplicarPermissoes(cadastro) !== false) {
      window.portalUsuarioValidado = true;
      liberarHtmlValidado();
      ocultarCarregando();
      notificarPortalPronto();
      try { iniciarHeartbeatPresenca(window.portalUsuario); } catch (_) {}
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
