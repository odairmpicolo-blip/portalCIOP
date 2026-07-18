/* Portal CIOP — comportamento do pack futurístico */
(function () {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function agoraLabel() {
    const d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function countVisibleCards() {
    return Array.from(document.querySelectorAll(".card")).filter((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    }).length;
  }

  function atualizarCommandCenter() {
    const hora = document.getElementById("ciopKpiHora");
    const mods = document.getElementById("ciopKpiModulos");
    const avisos = document.getElementById("ciopKpiAvisos");
    const status = document.getElementById("ciopKpiStatus");
    const liveText = document.getElementById("ciopLiveText");

    if (hora) hora.textContent = agoraLabel();
    if (mods) mods.textContent = String(countVisibleCards());

    if (avisos) {
      const contador = document.getElementById("avisosContador");
      const raw = contador ? String(contador.textContent || "").trim() : "";
      const n = Number.parseInt(raw, 10);
      avisos.textContent = Number.isFinite(n) ? String(n) : raw || "—";
    }

    if (status) status.textContent = navigator.onLine ? "Online" : "Offline";
    if (liveText) liveText.textContent = navigator.onLine ? "Ao vivo" : "Offline";
  }

  function staggerCards() {
    if (document.body.classList.contains("oa-page")) return;
    const cards = document.querySelectorAll(".grid .card");
    cards.forEach((card, i) => {
      card.classList.add("ciop-card-enter");
      card.style.animationDelay = Math.min(i * 0.045, 0.9) + "s";
    });
  }

  function bindRipples() {
    if (document.body.classList.contains("oa-page")) return;
    document.querySelectorAll(".grid .card-btn").forEach((btn) => {
      btn.addEventListener("click", function (ev) {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement("span");
        const size = Math.max(rect.width, rect.height);
        ripple.className = "ciop-ripple";
        ripple.style.width = ripple.style.height = size + "px";
        ripple.style.left = ev.clientX - rect.left - size / 2 + "px";
        ripple.style.top = ev.clientY - rect.top - size / 2 + "px";
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      });
    });
  }

  function bindFlashSalvar() {
    document.querySelectorAll('#senhaPanel .btn-small:not(.secondary), [onclick*="salvar"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const panel = btn.closest(".password-panel, .panel, .card, section");
        if (!panel) return;
        panel.classList.remove("ciop-flash-ok");
        void panel.offsetWidth;
        panel.classList.add("ciop-flash-ok");
      });
    });
  }

  function ensureIconGradient() {
    if (document.getElementById("ciopCardIconGrad")) return;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";

    function addGrad(id, stops) {
      const grad = document.createElementNS(ns, "linearGradient");
      grad.setAttribute("id", id);
      grad.setAttribute("x1", "0%");
      grad.setAttribute("y1", "0%");
      grad.setAttribute("x2", "100%");
      grad.setAttribute("y2", "100%");
      stops.forEach(function (s) {
        const stop = document.createElementNS(ns, "stop");
        stop.setAttribute("offset", s[0]);
        stop.setAttribute("stop-color", s[1]);
        grad.appendChild(stop);
      });
      return grad;
    }

    const defs = document.createElementNS(ns, "defs");
    defs.appendChild(
      addGrad("ciopCardIconGrad", [
        ["0%", "#06245c"],
        ["45%", "#0b3a8a"],
        ["100%", "#ff6b00"],
      ])
    );
    defs.appendChild(
      addGrad("ciopCardIconGradDark", [
        ["0%", "#38bdf8"],
        ["50%", "#0b3a8a"],
        ["100%", "#ff6b00"],
      ])
    );
    svg.appendChild(defs);
    document.body.prepend(svg);
  }

  function ensureHud() {
    if (document.body.classList.contains("oa-page")) return;
    if (!document.querySelector(".portal-hud-overlay")) {
      const overlay = document.createElement("div");
      overlay.className = "portal-hud-overlay";
      overlay.setAttribute("aria-hidden", "true");
      document.body.prepend(overlay);
    }
    if (!document.querySelector(".portal-hud-scan")) {
      const scan = document.createElement("div");
      scan.className = "portal-hud-scan";
      scan.setAttribute("aria-hidden", "true");
      document.body.appendChild(scan);
    }
  }

  function init() {
    ensureIconGradient();
    ensureHud();
    atualizarCommandCenter();
    staggerCards();
    bindRipples();
    bindFlashSalvar();
    setInterval(atualizarCommandCenter, 1000);
    window.addEventListener("online", atualizarCommandCenter);
    window.addEventListener("offline", atualizarCommandCenter);
    window.addEventListener("portal:usuario-validado", () => {
      setTimeout(atualizarCommandCenter, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
