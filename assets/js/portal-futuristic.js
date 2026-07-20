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

  function atualizarKpiUsuariosLogados(lista) {
    const el = document.getElementById("ciopKpiUsuarios");
    if (!el) return;
    const n = Array.isArray(lista) ? lista.length : 0;
    el.dataset.live = "1";
    el.textContent = String(n);
    el.title = n === 1 ? "1 usuário logado agora" : n + " usuários logados agora";
  }

  var CLIMA_CACHE_KEY = "ciop_clima_londrina_v1";
  var CLIMA_TTL_MS = 10 * 60 * 1000;
  var CLIMA_LAT = -23.3045;
  var CLIMA_LON = -51.1696;
  var climaTimer = null;

  function grauLabel(n) {
    if (!Number.isFinite(n)) return "—°";
    return Math.round(n) + "°";
  }

  function isNoiteLocal() {
    var h = new Date().getHours();
    return h < 6 || h >= 18;
  }

  function climaPorCodigo(code) {
    var c = Number(code);
    var noite = isNoiteLocal();
    if (c === 0) {
      return {
        desc: noite ? "Céu limpo" : "Ensolarado",
        kind: noite ? "clear-night" : "clear",
      };
    }
    if (c === 1) {
      return {
        desc: noite ? "Predominantemente limpo" : "Predominantemente Ensolarado",
        kind: noite ? "clear-night" : "clear",
      };
    }
    if (c === 2) return { desc: "Parcialmente nublado", kind: "partly" };
    if (c === 3) return { desc: "Nublado", kind: "cloudy" };
    if (c === 45 || c === 48) return { desc: "Neblina", kind: "fog" };
    if (c >= 51 && c <= 57) return { desc: "Garoa", kind: "drizzle" };
    if (c >= 61 && c <= 67) return { desc: "Chuva", kind: "rain" };
    if (c >= 71 && c <= 77) return { desc: "Neve", kind: "snow" };
    if (c >= 80 && c <= 82) return { desc: "Pancadas de chuva", kind: "rain" };
    if (c >= 85 && c <= 86) return { desc: "Pancadas de neve", kind: "snow" };
    if (c >= 95) return { desc: "Tempestade", kind: "storm" };
    return { desc: "Condição variável", kind: "cloudy" };
  }

  function iconeClimaSvg(kind) {
    if (kind === "clear") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="#FBBF24"/><g stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></g></svg>';
    }
    if (kind === "clear-night") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E2E8F0" d="M14.5 3.2a8.6 8.6 0 1 0 6.3 14.1A7.2 7.2 0 0 1 14.5 3.2z"/></svg>';
    }
    if (kind === "partly") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9.2" cy="9" r="3.2" fill="#FBBF24"/><path fill="#E2E8F0" d="M8.5 18.5h9.2a3.6 3.6 0 0 0 .4-7.2 4.6 4.6 0 0 0-8.7 1.4 3.3 3.3 0 0 0-.9 5.8z"/></svg>';
    }
    if (kind === "rain" || kind === "drizzle") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E2E8F0" d="M7.8 15.2h9.4a3.5 3.5 0 0 0 .3-7 4.5 4.5 0 0 0-8.6 1.2 3.2 3.2 0 0 0-1.1 5.8z"/><g stroke="#93C5FD" stroke-width="1.6" stroke-linecap="round"><path d="M9 17.2v2.2M12 17.8v2.2M15 17.2v2.2"/></g></svg>';
    }
    if (kind === "storm") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#CBD5E1" d="M7.5 13.8h9.2a3.3 3.3 0 0 0 .3-6.6 4.3 4.3 0 0 0-8.3 1.1A3.1 3.1 0 0 0 7.5 13.8z"/><path fill="#FBBF24" d="M12.8 14.2 10.2 18h2.1l-1.5 3.6 4.4-5.2h-2.2l1.8-2.2z"/></svg>';
    }
    if (kind === "snow") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E2E8F0" d="M7.8 14.5h9.4a3.5 3.5 0 0 0 .3-7 4.5 4.5 0 0 0-8.6 1.2 3.2 3.2 0 0 0-1.1 5.8z"/><g stroke="#BFDBFE" stroke-width="1.5" stroke-linecap="round"><path d="M9.2 17.2v2M12 16.8v2.4M14.8 17.2v2"/></g></svg>';
    }
    if (kind === "fog") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#E2E8F0" stroke-width="1.8" stroke-linecap="round"><path d="M4 9.5h16M5 12.5h14M6 15.5h12"/></g></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#E2E8F0" d="M7.5 17h10a3.8 3.8 0 0 0 .4-7.5 5 5 0 0 0-9.5 1.4A3.5 3.5 0 0 0 7.5 17z"/></svg>';
  }

  function lerCacheClima() {
    try {
      var raw = sessionStorage.getItem(CLIMA_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || !parsed.data) return null;
      if (Date.now() - parsed.ts > CLIMA_TTL_MS) return null;
      return parsed.data;
    } catch (_) {
      return null;
    }
  }

  function gravarCacheClima(data) {
    try {
      sessionStorage.setItem(CLIMA_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (_) {}
  }

  function aplicarClima(data) {
    var root = document.getElementById("ciopKpiClima");
    var tempEl = document.getElementById("ciopClimaTemp");
    var descEl = document.getElementById("ciopClimaDesc");
    var rangeEl = document.getElementById("ciopClimaRange");
    var iconEl = document.getElementById("ciopClimaIcon");
    if (!root || !data) return;

    var meta = climaPorCodigo(data.code);
    if (tempEl) tempEl.textContent = grauLabel(data.temp);
    if (descEl) descEl.textContent = meta.desc;
    if (rangeEl) {
      rangeEl.textContent = "Máx " + grauLabel(data.max) + " Mín " + grauLabel(data.min);
    }
    if (iconEl) iconEl.innerHTML = iconeClimaSvg(meta.kind);
    root.title =
      "Londrina · " +
      grauLabel(data.temp) +
      " · " +
      meta.desc +
      " · Máx " +
      grauLabel(data.max) +
      " Mín " +
      grauLabel(data.min);
    root.dataset.live = "1";
  }

  function buscarClimaLondrina(force) {
    var root = document.getElementById("ciopKpiClima");
    if (!root) return Promise.resolve();

    if (!force) {
      var cached = lerCacheClima();
      if (cached) {
        aplicarClima(cached);
        return Promise.resolve(cached);
      }
    }

    var url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" +
      CLIMA_LAT +
      "&longitude=" +
      CLIMA_LON +
      "&current=temperature_2m,weather_code" +
      "&daily=temperature_2m_max,temperature_2m_min" +
      "&timezone=America%2FSao_Paulo&forecast_days=1";

    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("clima http " + res.status);
        return res.json();
      })
      .then(function (json) {
        var data = {
          temp: Number(json?.current?.temperature_2m),
          code: Number(json?.current?.weather_code),
          max: Number(json?.daily?.temperature_2m_max?.[0]),
          min: Number(json?.daily?.temperature_2m_min?.[0]),
        };
        gravarCacheClima(data);
        aplicarClima(data);
        return data;
      })
      .catch(function () {
        if (root.dataset.live === "1") return null;
        var descEl = document.getElementById("ciopClimaDesc");
        if (descEl) descEl.textContent = "Indisponível";
        return null;
      });
  }

  function iniciarClimaCommandCenter() {
    if (!document.getElementById("ciopKpiClima")) return;
    buscarClimaLondrina(false);
    if (climaTimer) window.clearInterval(climaTimer);
    climaTimer = window.setInterval(function () {
      buscarClimaLondrina(true);
    }, CLIMA_TTL_MS);
    window.addEventListener("online", function () {
      buscarClimaLondrina(true);
    });
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
    iniciarClimaCommandCenter();
    window.addEventListener("portal:presenca", (ev) => {
      atualizarKpiUsuariosLogados(ev?.detail?.usuarios);
    });
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
