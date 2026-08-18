/* Overlay 3D + cockpit (trilho, cards, atalhos) — home e páginas internas. */
(function () {
  if (document.getElementById("kiosk")) return;
  if (document.body && document.body.classList.contains("login-v2")) return;
  if (/painel-tv/.test(window.location.pathname || "")) return;

  var inPages = (window.location.pathname || "").indexOf("/pages/") !== -1;
  var base = inPages ? "../" : "";

  function ensure3d() {
    if (document.querySelector(".portal-fx-3d")) return;
    var wrap = document.createElement("div");
    wrap.className = "portal-fx-3d";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML =
      '<div class="portal-fx-3d-ceil"></div>' +
      '<div class="portal-fx-3d-floor"></div>' +
      '<div class="portal-fx-3d-scan"></div>' +
      '<div class="portal-fx-bus"></div>' +
      '<svg class="portal-fx-3d-lines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" focusable="false">' +
        "<defs>" +
          '<linearGradient id="fxLineAzul" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#38bdf8" stop-opacity="0"/>' +
            '<stop offset="35%" stop-color="#38bdf8" stop-opacity=".85"/>' +
            '<stop offset="100%" stop-color="#06245c" stop-opacity=".1"/>' +
          "</linearGradient>" +
          '<linearGradient id="fxLineLaranja" x1="1" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#ff6b00" stop-opacity="0"/>' +
            '<stop offset="40%" stop-color="#ff6b00" stop-opacity=".8"/>' +
            '<stop offset="100%" stop-color="#ffb347" stop-opacity=".05"/>' +
          "</linearGradient>" +
        "</defs>" +
        '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
          '<path stroke="url(#fxLineAzul)" stroke-width="1" d="M80 120 L260 120 L320 220 L520 220 L560 80 L820 80"/>' +
          '<path stroke="url(#fxLineAzul)" stroke-width="1.2" d="M40 420 L180 360 L180 240 L340 240"/>' +
          '<path stroke="url(#fxLineLaranja)" stroke-width="1.5" d="M1360 90 L1180 90 L1120 180 L980 180 L940 60"/>' +
          '<path stroke="url(#fxLineLaranja)" stroke-width="1.2" d="M1400 380 L1260 320 L1260 210 L1100 210"/>' +
          '<path stroke="url(#fxLineAzul)" stroke-width="1" d="M720 40 L720 160 L860 200 L1020 200"/>' +
          '<path stroke="url(#fxLineLaranja)" stroke-width="1" d="M200 760 L360 680 L640 680 L760 560"/>' +
          '<path stroke="url(#fxLineAzul)" stroke-width="1.1" d="M90 640 L90 520 L220 480 L220 400"/>' +
          '<path stroke="url(#fxLineLaranja)" stroke-width="1.1" d="M1350 640 L1350 500 L1220 460 L1220 380"/>' +
          '<circle cx="260" cy="120" r="3.2" fill="#38bdf8"/>' +
          '<circle cx="320" cy="220" r="2.6" fill="#7dd3fc"/>' +
          '<circle cx="1180" cy="90" r="3.2" fill="#ff6b00"/>' +
          '<circle cx="1120" cy="180" r="2.6" fill="#ffb347"/>' +
          '<circle cx="180" cy="360" r="2.4" fill="#38bdf8"/>' +
          '<circle cx="640" cy="680" r="2.4" fill="#ff6b00"/>' +
        "</g>" +
      "</svg>";
    if (document.body) document.body.insertBefore(wrap, document.body.firstChild);
  }

  function ico(d) {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="' +
      d +
      '"/></svg>'
    );
  }

  function goTab(id) {
    try {
      localStorage.setItem("portalCiopAbaAtiva", id);
    } catch (_) {}
    var tab = document.querySelector('.portal-aba[data-alvo="' + id + '"]');
    if (tab) {
      tab.click();
      return;
    }
    window.location.href = base + "index.html";
  }

  function ensureRail() {
    if (document.getElementById("portalRail")) return;
    var nav = document.createElement("nav");
    nav.className = "portal-rail";
    nav.id = "portalRail";
    nav.setAttribute("aria-label", "Navegação do portal");
    nav.innerHTML =
      '<a class="portal-rail-item" data-rail="inicio" href="' +
      base +
      'index.html">' +
      ico("M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1V10.5Z") +
      "<span>Início</span></a>" +
      '<button type="button" class="portal-rail-item" data-rail="secaoOperacao">' +
      ico("M4 12h4l3-7 2 14 3-7h4") +
      "<span>Operação</span></button>" +
      '<button type="button" class="portal-rail-item" data-rail="secaoDashboards">' +
      ico("M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z") +
      "<span>Dashboards</span></button>" +
      '<button type="button" class="portal-rail-item" data-rail="secaoRelatorios">' +
      ico("M7 3h8l4 4v14H7V3zM15 3v5h4M9 13h6M9 17h4") +
      "<span>Relatórios</span></button>" +
      '<button type="button" class="portal-rail-item" data-rail="alertas">' +
      ico("M15.2 17.6a3.2 3.2 0 0 1-6.4 0M6.2 8.8a5.8 5.8 0 1 1 11.6 0c0 4.2 1.4 5.4 1.4 5.4H4.8s1.4-1.2 1.4-5.4") +
      '<span>Alertas</span><b class="portal-rail-badge" id="portalRailAlertasBadge" hidden>0</b></button>' +
      '<button type="button" class="portal-rail-item" data-rail="config">' +
      ico("M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a7.8 7.8 0 0 0 .1-1l2-1.2-2-3.4-2.3.5a8 8 0 0 0-.9-.5l-.4-2.4h-4l-.4 2.4a8 8 0 0 0-.9.5L8.5 8.4l-2 3.4 2 1.2a7.8 7.8 0 0 0 .1 1l-2 1.2 2 3.4 2.3-.5c.3.2.6.4.9.5l.4 2.4h4l.4-2.4c.3-.2.6-.3.9-.5l2.3.5 2-3.4-2-1.2z") +
      "<span>Configurações</span></button>" +
      '<a class="portal-rail-item portal-rail-support" data-rail="suporte" href="https://web.whatsapp.com/" target="_blank" rel="noopener noreferrer">' +
      ico("M12 3a9 9 0 0 0-6.3 15.4L5 21l2.8-.7A9 9 0 1 0 12 3zM8.5 9.2c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.4.2.5.7 1.7.7 1.8s0 .3-.2.5l-.3.4c-.1.1-.2.3 0 .5.2.3.8 1.3 1.8 2.1 1.2.9 2.2 1.2 2.5 1.3s.4 0 .6-.2l.4-.5c.2-.2.3-.2.5-.1.2.1 1.4.7 1.6.8s.4.2.4.4 0 1.2-.5 1.7c-.5.5-1.1.6-1.5.6h-.4A8 8 0 0 1 8.5 9.2z") +
      "<span>Suporte</span></a>";
    document.body.appendChild(nav);
    document.documentElement.classList.add("portal-cockpit");

    nav.addEventListener("click", function (ev) {
      var item = ev.target.closest("[data-rail]");
      if (!item) return;
      var rail = item.getAttribute("data-rail");
      if (rail === "inicio") return;
      if (rail === "suporte") return;
      ev.preventDefault();
      if (rail.indexOf("secao") === 0) goTab(rail);
      if (rail === "alertas") {
        if (typeof window.abrirPopupAvisos === "function") window.abrirPopupAvisos();
        else document.getElementById("ciopBellAvisos")?.click();
      }
      if (rail === "config") {
        if (typeof window.toggleMenu === "function") window.toggleMenu();
        else if (typeof window.dkSetPref === "function") {
          window.dkSetPref(document.documentElement.classList.contains("dk-dark") ? "light" : "dark");
        }
      }
    });
  }

  function markRail() {
    var onHome = !!document.getElementById("portalAbas");
    document.querySelectorAll(".portal-rail-item").forEach(function (el) {
      var rail = el.getAttribute("data-rail");
      var on = false;
      if (rail === "inicio") on = onHome;
      if (rail && rail.indexOf("secao") === 0) {
        var tab = document.querySelector('.portal-aba[data-alvo="' + rail + '"]');
        on = !!(tab && tab.getAttribute("aria-selected") === "true");
      }
      el.classList.toggle("is-active", on);
    });
  }

  function ensureCardBtns() {
    document.querySelectorAll(".grid .card").forEach(function (card) {
      if (card.querySelector(".card-btn")) return;
      var btn = document.createElement("span");
      btn.className = "card-btn";
      var rel = card.closest("#secaoRelatorios");
      btn.textContent = rel ? "Abrir relatório →" : "Acessar →";
      card.appendChild(btn);
    });
  }

  function ensureSearchKbd() {
    var label = document.querySelector(".ciop-search");
    if (!label || label.querySelector(".ciop-search-kbd")) return;
    var kbd = document.createElement("kbd");
    kbd.className = "ciop-search-kbd";
    kbd.textContent = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘ K" : "Ctrl K";
    label.appendChild(kbd);
  }

  function ensureAvisosStrip() {
    if (!document.getElementById("portalAbas") || document.getElementById("portalAvisosStrip")) return;
    var strip = document.createElement("div");
    strip.className = "portal-avisos-strip";
    strip.id = "portalAvisosStrip";
    strip.innerHTML =
      '<span class="portal-avisos-pill">Avisos <b id="portalAvisosCount">0</b></span>' +
      '<div class="portal-avisos-copy"><em>Cenário</em><span id="portalAvisosTexto">Carregando avisos…</span></div>' +
      '<button type="button" class="portal-avisos-more" id="portalAvisosMore">Ver detalhes →</button>';
    var tabs = document.getElementById("portalAbas");
    if (tabs && tabs.parentNode) tabs.parentNode.insertBefore(strip, tabs);
    document.getElementById("portalAvisosMore")?.addEventListener("click", function () {
      if (typeof window.abrirPopupAvisos === "function") window.abrirPopupAvisos();
    });
    strip.addEventListener("click", function (ev) {
      if (ev.target.closest(".portal-avisos-more")) return;
      if (typeof window.abrirPopupAvisos === "function") window.abrirPopupAvisos();
    });
  }

  function syncAvisos() {
    var n = document.getElementById("ciopKpiAvisos");
    var count = n ? String(n.textContent || "").trim() : "0";
    var empty = !count || count === "—" || count === "0";
    ["portalRailAlertasBadge", "portalAvisosCount"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.textContent = empty ? "0" : count;
      if (id === "portalRailAlertasBadge") el.hidden = empty;
    });
    var txt = document.getElementById("portalAvisosTexto");
    if (txt) {
      var title = document.querySelector(
        "#avisosLista .notice-item-title-inner, #avisosLista .notice-item-title"
      );
      txt.textContent = title ? title.textContent.trim() : "Próximo cenário operacional";
    }
  }

  function boot() {
    ensure3d();
    ensureRail();
    ensureCardBtns();
    ensureSearchKbd();
    ensureAvisosStrip();
    markRail();
    syncAvisos();
    document.addEventListener("click", function (ev) {
      if (ev.target.closest(".portal-aba")) setTimeout(markRail, 0);
    });
    var lista = document.getElementById("avisosLista");
    if (lista && window.MutationObserver) {
      new MutationObserver(syncAvisos).observe(lista, { childList: true, subtree: true });
    }
    document.addEventListener("keydown", function (e) {
      if (!(e.metaKey || e.ctrlKey) || String(e.key).toLowerCase() !== "k") return;
      var input = document.getElementById("ciopBuscaModulos");
      if (!input) return;
      e.preventDefault();
      input.focus();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
