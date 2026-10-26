(() => {
  const ID = "portalLoadingOverlay";
  const STYLE_ID = "portalLoadingStyle";
  let hideTimer = null;
  const logoLight = new URL("../img/portal-logo-clean-light.png", document.currentScript.src).href;
  const logoDark = new URL("../img/portal-logo-clean-dark.png", document.currentScript.src).href;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
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
  }

  function buildMarkup() {
    return `<div class="portal-loading-box">
 <div class="portal-loading-art" aria-hidden="true">
  <img class="portal-loading-logo portal-loading-logo-light" src="${logoLight}" alt="" decoding="async" onerror="this.onerror=null;this.src=this.src.replace('portal-logo-clean-light.png','logomarca-portalciop-tcgl-claro.png')">
  <img class="portal-loading-logo portal-loading-logo-dark" src="${logoDark}" alt="" decoding="async" onerror="this.onerror=null;this.src=this.src.replace('portal-logo-clean-dark.png','logomarca-portalciop-tcgl-escuro.png')">
 </div>
 <p class="portal-loading-title"></p>
 <p class="portal-loading-sub">Só um instante. Estamos preparando tudo.</p>
 <div class="portal-loading-bar" aria-hidden="true"><i></i></div>
 <p class="portal-loading-caption">TCGL · Operações</p>
</div>`;
  }

  function mostrar(texto = "Carregando") {
    window.clearTimeout(hideTimer);
    ensureStyle();
    let overlay = document.getElementById(ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = ID;
      overlay.className = "portal-loading-overlay";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.innerHTML = buildMarkup();
      document.body.appendChild(overlay);
    }
    const title = overlay.querySelector(".portal-loading-title");
    if (title) title.textContent = texto;
    overlay.classList.remove("hide");
  }

  function ocultar() {
    const overlay = document.getElementById(ID);
    if (!overlay) return;
    window.clearTimeout(hideTimer);
    overlay.classList.add("hide");
    hideTimer = window.setTimeout(() => overlay.remove(), 300);
  }

  window.portalUsuarioValidado = window.portalUsuarioValidado || false;
  window.portalAguardarUsuario = function (callback) {
    if (window.portalUsuarioValidado) {
      callback();
      return;
    }
    window.addEventListener("portal:usuario-validado", callback, { once: true });
  };

  function irParaLoginPorTimeout() {
    const path = window.location.pathname.toLowerCase();
    if (path.endsWith("/login.html") || path.endsWith("login.html")) {
      document.documentElement.classList.remove("portal-auth-pending");
      ocultar();
      return;
    }

    mostrar("Tempo excedido. Voltando ao login");
    window.setTimeout(() => {
      const inPages = window.location.pathname.includes("/pages/");
      window.location.href = (inPages ? "../" : "") + "login.html?erro=tempo";
    }, 1200);
  }

  window.portalLoadingWatchdog = window.setTimeout(() => {
    const overlay = document.getElementById(ID);
    if (!overlay || overlay.classList.contains("hide")) return;
    if (window.portalUsuarioValidado) return;
    irParaLoginPorTimeout();
  }, 15000);

  window.portalMostrarCarregando = mostrar;
  window.portalOcultarCarregando = ocultar;
})();
