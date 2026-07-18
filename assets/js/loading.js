(() => {
  const ID = "portalLoadingOverlay";
  const STYLE_ID = "portalLoadingStyle";
  let hideTimer = null;

  function assetBase() {
    return window.location.pathname.includes("/pages/") ? "../assets/" : "assets/";
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .portal-loading-overlay{
        position:fixed;
        inset:0;
        z-index:99999;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
        background:
          linear-gradient(180deg, rgba(6,20,50,.42) 0%, rgba(6,20,50,.62) 100%),
          var(--portal-loading-bg, #0a1424) center/cover no-repeat;
        backdrop-filter:blur(18px) saturate(160%);
        -webkit-backdrop-filter:blur(18px) saturate(160%);
        transition:opacity .32s ease,visibility .32s ease;
        overflow:hidden;
      }
      .portal-loading-overlay::before{
        content:"";
        position:absolute;
        inset:0;
        pointer-events:none;
        background:
          radial-gradient(ellipse 70% 50% at 50% 42%, rgba(11,58,138,.28), transparent 70%),
          linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
        background-size:auto, 48px 48px, 48px 48px;
        opacity:.85;
        animation:portalGridDrift 18s linear infinite;
      }
      .portal-loading-overlay::after{
        content:"";
        position:absolute;
        left:0;right:0;
        height:28%;
        top:-28%;
        pointer-events:none;
        background:linear-gradient(180deg, transparent, rgba(255,107,0,.12), transparent);
        animation:portalScan 3.2s ease-in-out infinite;
      }
      .portal-loading-overlay.hide{opacity:0;visibility:hidden;pointer-events:none}
      .portal-loading-box{
        position:relative;
        z-index:1;
        width:min(520px, 94vw);
        min-height:340px;
        padding:44px 40px 36px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:18px;
        text-align:center;
        border-radius:28px;
        border:1px solid rgba(255,255,255,.42);
        background:rgba(255,255,255,.24);
        backdrop-filter:blur(28px) saturate(190%);
        -webkit-backdrop-filter:blur(28px) saturate(190%);
        box-shadow:
          0 28px 70px -22px rgba(0,0,0,.5),
          inset 0 1px 0 rgba(255,255,255,.55),
          inset 0 -1px 0 rgba(255,255,255,.08);
        color:#f5f7fb;
        font-family:"SF Pro Display","Segoe UI",system-ui,-apple-system,sans-serif;
        overflow:hidden;
      }
      .portal-loading-box::before{
        content:"";
        position:absolute;
        inset:0;
        border-radius:inherit;
        pointer-events:none;
        background:linear-gradient(145deg, rgba(255,255,255,.28) 0%, transparent 42%, transparent 58%, rgba(255,107,0,.08) 100%);
      }
      .portal-loading-brand{
        position:relative;
        z-index:1;
        font-size:13px;
        font-weight:700;
        letter-spacing:.24em;
        text-transform:uppercase;
        color:rgba(255,255,255,.75);
      }
      .portal-loading-brand span{color:#ff8a3d}
      .portal-loading-mark{
        position:relative;
        z-index:1;
        width:124px;
        height:124px;
        display:grid;
        place-items:center;
        margin:4px 0;
      }
      .portal-loading-ring,
      .portal-loading-ring-2{
        position:absolute;
        inset:0;
        border-radius:50%;
        border:2px solid transparent;
      }
      .portal-loading-ring{
        border-top-color:rgba(255,255,255,.85);
        border-right-color:rgba(10,132,255,.7);
        animation:portalSpin 1.1s linear infinite;
        filter:drop-shadow(0 0 10px rgba(10,132,255,.5));
      }
      .portal-loading-ring-2{
        inset:14px;
        border-bottom-color:#ff6b00;
        border-left-color:rgba(255,107,0,.55);
        animation:portalSpin 1.7s linear infinite reverse;
        filter:drop-shadow(0 0 8px rgba(255,107,0,.45));
      }
      .portal-loading-core{
        width:72px;
        height:72px;
        border-radius:20px;
        display:grid;
        place-items:center;
        background:rgba(6,36,92,.45);
        border:1px solid rgba(255,255,255,.28);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 10px 24px rgba(0,0,0,.28);
      }
      .portal-loading-core svg{
        width:40px;
        height:40px;
        fill:none;
        stroke:#fff;
        stroke-width:1.7;
        stroke-linecap:round;
        stroke-linejoin:round;
      }
      .portal-loading-title{
        position:relative;
        z-index:1;
        margin:0;
        font-size:20px;
        font-weight:700;
        letter-spacing:.01em;
        color:#fff;
        text-shadow:0 1px 10px rgba(0,0,0,.28);
        max-width:100%;
        line-height:1.3;
      }
      .portal-loading-sub{
        position:relative;
        z-index:1;
        margin:-2px 0 0;
        font-size:13px;
        font-weight:500;
        letter-spacing:.05em;
        color:rgba(255,255,255,.7);
      }
      .portal-loading-bar{
        position:relative;
        z-index:1;
        width:78%;
        height:4px;
        margin-top:8px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(255,255,255,.16);
      }
      .portal-loading-bar > i{
        display:block;
        width:42%;
        height:100%;
        border-radius:inherit;
        background:linear-gradient(90deg, #0a84ff, #ff6b00);
        animation:portalBar 1.35s ease-in-out infinite;
        box-shadow:0 0 14px rgba(255,107,0,.55);
      }
      .portal-loading-dots{display:none}
      @keyframes portalSpin{to{transform:rotate(360deg)}}
      @keyframes portalBar{
        0%{transform:translateX(-120%)}
        100%{transform:translateX(280%)}
      }
      @keyframes portalScan{
        0%{transform:translateY(0);opacity:0}
        15%{opacity:.9}
        85%{opacity:.55}
        100%{transform:translateY(460%);opacity:0}
      }
      @keyframes portalGridDrift{
        to{background-position:0 0, 48px 48px, 48px 0}
      }
      @media (prefers-reduced-motion:reduce){
        .portal-loading-ring,
        .portal-loading-ring-2,
        .portal-loading-bar > i,
        .portal-loading-overlay::before,
        .portal-loading-overlay::after{animation:none}
      }
    `;
    document.head.appendChild(style);
  }

  function buildMarkup() {
    return `
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
        <p class="portal-loading-title"></p>
        <p class="portal-loading-sub">Monitoramento em tempo real</p>
        <div class="portal-loading-bar" aria-hidden="true"><i></i></div>
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
      overlay.style.setProperty(
        "--portal-loading-bg",
        `url("${assetBase()}img/portal-bg-onibus.jpg?v=20260716a")`
      );
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
    hideTimer = window.setTimeout(() => overlay.remove(), 320);
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
