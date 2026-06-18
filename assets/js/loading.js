(() => {
  const ID = "portalLoadingOverlay";
  const STYLE_ID = "portalLoadingStyle";
  let hideTimer = null;

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
        background:rgba(255,255,255,.78);
        backdrop-filter:blur(5px);
        transition:opacity .28s ease,visibility .28s ease;
      }
      .portal-loading-overlay.hide{opacity:0;visibility:hidden}
      .portal-loading-box{
        min-width:240px;
        padding:26px 30px;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:14px;
        border:1px solid rgba(6,36,92,.14);
        border-radius:10px;
        background:rgba(255,255,255,.94);
        box-shadow:0 20px 60px rgba(16,24,40,.18);
        color:#06245c;
        font-family:Arial,Helvetica,sans-serif;
      }
      .portal-loading-mark{position:relative;width:58px;height:58px}
      .portal-loading-mark::before,.portal-loading-mark::after{
        content:"";
        position:absolute;
        inset:0;
        border-radius:50%;
        border:4px solid transparent;
      }
      .portal-loading-mark::before{
        border-top-color:#06245c;
        border-right-color:#0b3a8a;
        animation:portalSpin .85s linear infinite;
      }
      .portal-loading-mark::after{
        inset:10px;
        border-bottom-color:#ff6b00;
        border-left-color:#ff6b00;
        animation:portalSpin 1.15s linear infinite reverse;
      }
      .portal-loading-title{font-size:15px;font-weight:800;letter-spacing:.2px}
      .portal-loading-dots{display:flex;gap:5px}
      .portal-loading-dots span{
        width:6px;
        height:6px;
        border-radius:50%;
        background:#ff6b00;
        animation:portalPulse 1s ease-in-out infinite;
      }
      .portal-loading-dots span:nth-child(2){animation-delay:.15s}
      .portal-loading-dots span:nth-child(3){animation-delay:.3s}
      @keyframes portalSpin{to{transform:rotate(360deg)}}
      @keyframes portalPulse{0%,80%,100%{opacity:.35;transform:translateY(0)}40%{opacity:1;transform:translateY(-4px)}}
    `;
    document.head.appendChild(style);
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
      overlay.innerHTML = `
        <div class="portal-loading-box">
          <div class="portal-loading-mark" aria-hidden="true"></div>
          <div class="portal-loading-title"></div>
          <div class="portal-loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        </div>`;
      document.body.appendChild(overlay);
    }
    overlay.querySelector(".portal-loading-title").textContent = texto;
    overlay.classList.remove("hide");
  }

  function ocultar() {
    const overlay = document.getElementById(ID);
    if (!overlay) return;
    hideTimer = window.setTimeout(() => {
      overlay.classList.add("hide");
      window.setTimeout(() => overlay.remove(), 300);
    }, 450);
  }

  window.portalMostrarCarregando = mostrar;
  window.portalOcultarCarregando = ocultar;
})();
