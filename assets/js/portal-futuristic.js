/* Portal CIOP — comportamento do pack futurístico */
(function () {
  function countVisibleCards() {
    return Array.from(document.querySelectorAll(".card")).filter((el) => {
      if (el.classList.contains("ciop-search-hidden")) return false;
      const style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden";
    }).length;
  }

  function dataCompletaLabel() {
    const d = new Date();
    const texto = d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function horaLabel() {
    return new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function atualizarCommandCenter() {
    const data = document.getElementById("ciopKpiData");
    const hora = document.getElementById("ciopKpiHora");
    const mods = document.getElementById("ciopKpiModulos");
    const avisos = document.getElementById("ciopKpiAvisos");
    const online = document.getElementById("ciopOnlineChip");
    const onlineText = online ? online.querySelector(".ciop-online-text") : null;
    const isOnline = navigator.onLine !== false;

    if (data) data.textContent = dataCompletaLabel();
    if (hora) hora.textContent = horaLabel();
    if (mods) mods.textContent = String(countVisibleCards());

    if (avisos) {
      const contador = document.getElementById("avisosContador");
      const raw = contador ? String(contador.textContent || "").trim() : "";
      const n = Number.parseInt(raw, 10);
      avisos.textContent = Number.isFinite(n) ? String(n) : raw || "—";
    }

    if (online) {
      online.classList.toggle("is-offline", !isOnline);
      online.title = isOnline ? "Portal online" : "Portal offline";
      online.setAttribute("aria-label", isOnline ? "Portal online" : "Portal offline");
      if (onlineText) onlineText.textContent = isOnline ? "Online" : "Offline";
    }
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

  function enhanceDuotoneIcons() {
    if (document.body.classList.contains("oa-page")) return;
    const ns = "http://www.w3.org/2000/svg";

    document.querySelectorAll(".grid .card-figure svg").forEach(function (svg, index) {
      if (svg.dataset.duotone === "1") return;
      svg.dataset.duotone = "1";
      if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", "0 0 24 24");

      var gradId = "ciopDuoGrad-" + index;
      var softId = "ciopDuoSoft-" + index;
      var isDark = document.documentElement.classList.contains("dk-dark");
      var stops = isDark
        ? [
            ["0%", "#38bdf8"],
            ["50%", "#0b3a8a"],
            ["100%", "#ff6b00"],
          ]
        : [
            ["0%", "#06245c"],
            ["45%", "#0b3a8a"],
            ["100%", "#ff6b00"],
          ];

      var defs = document.createElementNS(ns, "defs");
      var grad = document.createElementNS(ns, "linearGradient");
      grad.setAttribute("id", gradId);
      grad.setAttribute("x1", "0%");
      grad.setAttribute("y1", "0%");
      grad.setAttribute("x2", "100%");
      grad.setAttribute("y2", "100%");
      stops.forEach(function (s) {
        var stop = document.createElementNS(ns, "stop");
        stop.setAttribute("offset", s[0]);
        stop.setAttribute("stop-color", s[1]);
        grad.appendChild(stop);
      });
      defs.appendChild(grad);
      svg.insertBefore(defs, svg.firstChild);

      var soft = document.createElementNS(ns, "circle");
      soft.setAttribute("class", "ciop-duo-soft");
      soft.setAttribute("id", softId);
      soft.setAttribute("cx", "12");
      soft.setAttribute("cy", "12");
      soft.setAttribute("r", "9.2");
      soft.setAttribute("fill", "url(#" + gradId + ")");
      soft.setAttribute("fill-opacity", "0.18");
      soft.setAttribute("stroke", "none");
      svg.insertBefore(soft, defs.nextSibling);

      svg.querySelectorAll("path, line, polyline, polygon, circle, rect").forEach(function (el) {
        if (el.classList && el.classList.contains("ciop-duo-soft")) return;
        el.setAttribute("stroke", "url(#" + gradId + ")");
        el.setAttribute("stroke-width", el.getAttribute("stroke-width") || "2.15");
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-linejoin", "round");
        el.setAttribute("fill", "none");
        var tag = el.tagName.toLowerCase();
        if (tag === "circle" || tag === "rect") {
          el.setAttribute("fill", isDark ? "#ff8f3d" : "#ff6b00");
          el.setAttribute("fill-opacity", "0.2");
        }
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
    /* HUD desativado */
    document.querySelectorAll(".portal-hud-overlay, .portal-hud-scan").forEach(function (el) {
      el.remove();
    });
  }

  function bindModuleSearch() {
    const input = document.getElementById("ciopBuscaModulos");
    const clearBtn = document.getElementById("ciopBuscaLimpar");
    if (!input || document.body.classList.contains("oa-page")) return;

    // Evita que o gerenciador de senhas/autocomplete do navegador
    // preencha e-mail de login (ex.: usuários compartilhados) na busca.
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("data-lpignore", "true");
    input.setAttribute("data-1p-ignore", "true");
    input.setAttribute("data-form-type", "other");
    input.setAttribute("name", "ciop-filtro-modulos");
    if (input.type === "search") input.type = "text";

    function norm(s) {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    }

    function pareceEmail(s) {
      const v = String(s || "").trim();
      return v.includes("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }

    function limparAutofillIndevido() {
      if (!pareceEmail(input.value)) return false;
      input.value = "";
      return true;
    }

    function aplicar() {
      limparAutofillIndevido();
      const q = norm(input.value);
      if (clearBtn) clearBtn.hidden = !q;

      document.querySelectorAll(".grid .card").forEach(function (card) {
        if (card.hidden && !card.classList.contains("ciop-search-hidden")) return;
        const title = card.querySelector(".card-title")?.textContent || "";
        const desc = card.querySelector(".card-desc")?.textContent || "";
        const hit = !q || norm(title + " " + desc).includes(q);
        card.classList.toggle("ciop-search-hidden", !hit);
      });

      document.querySelectorAll(".card-section").forEach(function (sec) {
        const cards = sec.querySelectorAll(".grid .card");
        const visible = Array.from(cards).some(function (c) {
          return !c.classList.contains("ciop-search-hidden") && !c.hidden;
        });
        sec.classList.toggle("ciop-search-empty", !!q && !visible);
      });

      atualizarCommandCenter();
    }

    input.addEventListener("input", aplicar);
    input.addEventListener("change", aplicar);
    // Chrome às vezes preenche sem disparar "input"
    input.addEventListener("animationstart", function (ev) {
      if (String(ev.animationName || "").toLowerCase().includes("autofill") ||
          String(ev.animationName || "") === "onAutoFillStart") {
        setTimeout(function () {
          if (limparAutofillIndevido()) aplicar();
        }, 0);
      }
    });
    // readonly até o 1º foco real — reduz autofill automático de e-mail de login
    input.setAttribute("readonly", "readonly");
    input.addEventListener("focus", function onFocusBusca() {
      input.removeAttribute("readonly");
      if (limparAutofillIndevido()) aplicar();
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        input.value = "";
        input.focus();
        aplicar();
      });
    }

    // Limpa valor já autofilled no carregamento e reaplica após ACL
    setTimeout(aplicar, 0);
    setTimeout(aplicar, 400);
    window.addEventListener("portal:usuario-validado", function () {
      setTimeout(aplicar, 50);
    });
  }

  function init() {
    ensureIconGradient();
    enhanceDuotoneIcons();
    ensureHud();
    bindModuleSearch();
    atualizarCommandCenter();
    staggerCards();
    bindRipples();
    bindFlashSalvar();
    setInterval(atualizarCommandCenter, 1000);
    window.addEventListener("portal:usuario-validado", () => {
      setTimeout(function () {
        enhanceDuotoneIcons();
        atualizarCommandCenter();
      }, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
