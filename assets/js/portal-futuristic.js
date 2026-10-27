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
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function dataCurtaLabel() {
    const d = new Date();
    const weekday = d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
    const day = d.toLocaleDateString("pt-BR", { day: "numeric", timeZone: "America/Sao_Paulo" });
    const month = d.toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
    const wd = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return wd + ", " + day + " de " + month;
  }

  function horaLabel() {
    var parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(new Date());
    var h = "00";
    var m = "00";
    parts.forEach(function (p) {
      if (p.type === "hour") h = p.value.padStart(2, "0");
      if (p.type === "minute") m = p.value.padStart(2, "0");
    });
    return h + ":" + m;
  }

  function reduzirMovimento() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function pintarKpi(el, n, casas, sufixo) {
    var txt = casas > 0 ? n.toFixed(casas).replace(".", ",") : String(Math.round(n));
    el.textContent = txt + sufixo;
  }

  if (typeof window.portalContarNumero !== "function") {
    window.portalContarNumero = function (el, alvo, opts) {
      if (!el) return;
      opts = opts || {};
      var fim = Number(alvo);
      var sufixo = opts.suffix || "";
      var casas = Number(opts.decimals);
      if (!Number.isFinite(casas) || casas < 0) casas = 0;
      if (!Number.isFinite(fim)) {
        el.textContent = String(alvo == null ? "—" : alvo);
        return;
      }
      var chave = fim.toFixed(casas) + "|" + sufixo;
      if (el.dataset.countTo === chave) return;
      el.dataset.countTo = chave;
      var bruto = String(el.textContent || "").replace(/[^\d,-]/g, "").replace(",", ".");
      var inicio = Number(bruto);
      if (!Number.isFinite(inicio) || !bruto) inicio = 0;
      if (reduzirMovimento() || Math.abs(fim - inicio) < (casas ? Math.pow(10, -casas) : 1)) {
        pintarKpi(el, fim, casas, sufixo);
        return;
      }
      if (el._countRaf) cancelAnimationFrame(el._countRaf);
      el.dataset.counting = "1";
      var t0 = performance.now();
      var dur = (opts.duration || 0.85) * 1000;
      function tick(now) {
        var p = Math.min(1, (now - t0) / dur);
        var ease = 1 - Math.pow(1 - p, 3);
        pintarKpi(el, inicio + (fim - inicio) * ease, casas, sufixo);
        if (p < 1) el._countRaf = requestAnimationFrame(tick);
        else {
          pintarKpi(el, fim, casas, sufixo);
          el._countRaf = 0;
          delete el.dataset.counting;
        }
      }
      el._countRaf = requestAnimationFrame(tick);
    };
  }

  function setKpiNumero(el, n, opts) {
    if (!el) return;
    if (!Number.isFinite(n)) {
      el.textContent = "—";
      delete el.dataset.countTo;
      return;
    }
    window.portalContarNumero(el, n, opts);
  }

  function parseKpiTexto(txt) {
    var s = String(txt || "").trim();
    if (!s || s === "—" || s === "-" || s === "–") return null;
    if (/^\d{1,2}:\d{2}/.test(s)) return null;
    if (/\d{1,2}\/\d{1,2}/.test(s)) return null;
    if (/[A-Za-zÀ-ú]{3,}/.test(s) && !/%/.test(s)) return null;
    var m = s.match(/^(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:[.,]\d+)?)(\s*%|°|)$/);
    if (!m) return null;
    var raw = m[1];
    var suffix = m[2] || "";
    var n;
    if (raw.indexOf(",") >= 0) n = Number(raw.replace(/\./g, "").replace(",", "."));
    else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) n = Number(raw.replace(/\./g, ""));
    else n = Number(raw);
    if (!Number.isFinite(n) || Math.abs(n) > 1e9) return null;
    var dec = 0;
    var frac = raw.split(/[.,]/)[1];
    if (frac) dec = frac.length;
    return { n: n, suffix: suffix, decimals: dec };
  }

  function ligarContagemPagina() {
    var sel = ".kpi-value, .kpi-card .val, .stat-card .val, .card-value, .ciop-kpi-num";
    var skip = { ciopKpiHora: 1, ciopKpiData: 1, ciopClimaTemp: 1 };
    function aplicar(el) {
      if (!el || skip[el.id]) return;
      if (el.closest && el.closest(".paper, .leaflet-container")) return;
      if (el._countRaf || el._countTween || el.dataset.counting === "1" || (el.classList && el.classList.contains("is-counting"))) return;
      var parsed = parseKpiTexto(el.textContent);
      if (!parsed) return;
      window.portalContarNumero(el, parsed.n, {
        suffix: parsed.suffix,
        decimals: parsed.decimals
      });
    }
    function varrer(root) {
      (root.querySelectorAll ? root : document).querySelectorAll(sel).forEach(aplicar);
    }
    varrer(document);
    if (!window.MutationObserver) return;
    var obs = new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === "characterData" && m.target && m.target.parentElement) aplicar(m.target.parentElement);
        if (m.type === "childList") {
          if (m.target && m.target.matches && m.target.matches(sel)) aplicar(m.target);
          Array.prototype.forEach.call(m.addedNodes || [], function (n) {
            if (n.nodeType !== 1) return;
            if (n.matches && n.matches(sel)) aplicar(n);
            if (n.querySelectorAll) n.querySelectorAll(sel).forEach(aplicar);
          });
        }
      });
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function garantirWallpaper() {
    if (document.body.classList.contains("login-v2")) return;
    var file = (location.pathname.split("/").pop() || "").split("?")[0];
    if (/^login\.html$/.test(file)) return;
    if (document.querySelector(".bg-wall, .body-bg-wall")) return;
    var wall = document.createElement("div");
    wall.className = "body-bg-wall";
    wall.setAttribute("aria-hidden", "true");
    document.body.insertBefore(wall, document.body.firstChild);
  }

  function atualizarCommandCenter() {
    const data = document.getElementById("ciopKpiData");
    const hora = document.getElementById("ciopKpiHora");
    const mods = document.getElementById("ciopKpiModulos");
    const avisos = document.getElementById("ciopKpiAvisos");
    const online = document.getElementById("ciopOnlineChip");
    const onlineText = online ? online.querySelector(".ciop-online-text") : null;
    const isOnline = navigator.onLine !== false;

    if (data) {
      data.textContent = dataCurtaLabel();
      data.title = dataCompletaLabel();
    }
    if (hora) hora.textContent = horaLabel();
    setKpiNumero(mods, countVisibleCards(), { delay: 0 });

    if (avisos) {
      const contador = document.getElementById("avisosContador");
      const raw = contador ? String(contador.textContent || "").trim() : "";
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) setKpiNumero(avisos, n, { delay: 0.18 });
      else avisos.textContent = raw || "—";
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
    setKpiNumero(el, n, { delay: 0.09 });
    el.title = n === 1 ? "1 usuário ativo agora" : n + " usuários ativos agora";
  }

  function iniciarKpiPresenca() {
    if (!document.getElementById("ciopKpiUsuarios")) return;
    import("./portal-presenca.js").then((m) => {
      m.ouvirPresenca(atualizarKpiUsuariosLogados);
    }).catch((err) => {
      console.warn("Presença de usuários indisponível:", err);
    });
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
    var h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    return h < 6 || h >= 18;
  }

  function climaPorCodigo(code, isDay) {
    var c = Number(code);
    var noite = typeof isDay === "boolean" ? !isDay : isNoiteLocal();
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
    if (c === 2) return { desc: "Parcialmente nublado", kind: noite ? "partly-night" : "partly" };
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
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="wx-sun-rays" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/></g><circle class="wx-sun-core" cx="12" cy="12" r="4.2" fill="#FBBF24"/></svg>';
    }
    if (kind === "clear-night") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="wx-star" cx="6" cy="7" r="1" fill="#E2E8F0"/><circle class="wx-star" cx="19" cy="6" r=".8" fill="#E2E8F0"/><path class="wx-moon" fill="#E2E8F0" d="M14.5 3.2a8.6 8.6 0 1 0 6.3 14.1A7.2 7.2 0 0 1 14.5 3.2z"/></svg>';
    }
    if (kind === "partly-night") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="wx-moon" fill="#c9dbf9" d="M10 2a6 6 0 1 0 6 8 5 5 0 0 1-6-8Z"/><path class="wx-cloud" fill="#94a9bf" d="M8 20h10a4 4 0 0 0 0-8 5 5 0 0 0-9-1 4.5 4.5 0 0 0-1 9Z"/></svg>';
    }
    if (kind === "partly") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><g class="wx-sun-rays" stroke="#FBBF24" stroke-width="1.5" stroke-linecap="round"><path d="M9.2 2.6v1.6M3.2 9h1.6M4.4 4.4l1.2 1.2"/></g><circle class="wx-sun-core" cx="9.2" cy="9" r="3.2" fill="#FBBF24"/><path class="wx-cloud" fill="#E2E8F0" d="M8.5 18.5h9.2a3.6 3.6 0 0 0 .4-7.2 4.6 4.6 0 0 0-8.7 1.4 3.3 3.3 0 0 0-.9 5.8z"/></svg>';
    }
    if (kind === "rain" || kind === "drizzle") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="wx-cloud" fill="#E2E8F0" d="M7.8 15.2h9.4a3.5 3.5 0 0 0 .3-7 4.5 4.5 0 0 0-8.6 1.2 3.2 3.2 0 0 0-1.1 5.8z"/><g stroke="#93C5FD" stroke-width="1.6" stroke-linecap="round"><path class="wx-drop" d="M9 17.2v2.2"/><path class="wx-drop" d="M12 17.8v2.2"/><path class="wx-drop" d="M15 17.2v2.2"/></g></svg>';
    }
    if (kind === "storm") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="wx-cloud" fill="#CBD5E1" d="M7.5 13.8h9.2a3.3 3.3 0 0 0 .3-6.6 4.3 4.3 0 0 0-8.3 1.1A3.1 3.1 0 0 0 7.5 13.8z"/><path class="wx-bolt" fill="#FBBF24" d="M12.8 14.2 10.2 18h2.1l-1.5 3.6 4.4-5.2h-2.2l1.8-2.2z"/></svg>';
    }
    if (kind === "snow") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="wx-cloud" fill="#E2E8F0" d="M7.8 14.5h9.4a3.5 3.5 0 0 0 .3-7 4.5 4.5 0 0 0-8.6 1.2 3.2 3.2 0 0 0-1.1 5.8z"/><g fill="#BFDBFE"><circle class="wx-flake" cx="9.2" cy="18.4" r="1"/><circle class="wx-flake" cx="12" cy="19.2" r="1.1"/><circle class="wx-flake" cx="14.8" cy="18.4" r="1"/></g></svg>';
    }
    if (kind === "fog") {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#E2E8F0" stroke-width="1.8" stroke-linecap="round"><path class="wx-fog-line" d="M4 9.5h16"/><path class="wx-fog-line" d="M5 12.5h14"/><path class="wx-fog-line" d="M6 15.5h12"/></g></svg>';
    }
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="wx-cloud" fill="#E2E8F0" d="M7.5 17h10a3.8 3.8 0 0 0 .4-7.5 5 5 0 0 0-9.5 1.4A3.5 3.5 0 0 0 7.5 17z"/></svg>';
  }

  function horaCurtaDeIso(iso) {
    var m = String(iso || "").match(/T(\d{2}):(\d{2})/);
    if (m) return m[1] + ":" + m[2];
    if (!iso) return "";
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    });
  }

  function lerPacoteClima() {
    try {
      var raw = sessionStorage.getItem(CLIMA_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function gravarCacheClima(data) {
    try {
      sessionStorage.setItem(CLIMA_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (_) {}
  }

  function marcarClimaIndisponivel() {
    var root = document.getElementById("ciopKpiClima");
    var tempEl = document.getElementById("ciopClimaTemp");
    var rangeEl = document.getElementById("ciopClimaRange");
    var descEl = document.getElementById("ciopClimaDesc");
    var stampEl = document.getElementById("ciopClimaStamp");
    var iconEl = document.getElementById("ciopClimaIcon");
    if (!root) return;
    root.classList.add("is-unavailable");
    root.dataset.live = "0";
    if (tempEl) tempEl.textContent = "—";
    if (rangeEl) rangeEl.textContent = "";
    if (descEl) descEl.textContent = "Clima indisponível";
    if (stampEl) stampEl.textContent = "";
    if (iconEl) {
      iconEl.className = "ciop-clima-icon wx-live is-off";
      iconEl.innerHTML = iconeClimaSvg("cloudy");
    }
    root.setAttribute("aria-label", "Abrir previsão completa do tempo em Londrina. Clima indisponível no momento.");
  }

  function aplicarClima(data, opts) {
    var root = document.getElementById("ciopKpiClima");
    var tempEl = document.getElementById("ciopClimaTemp");
    var rangeEl = document.getElementById("ciopClimaRange");
    var iconEl = document.getElementById("ciopClimaIcon");
    var descEl = document.getElementById("ciopClimaDesc");
    var stampEl = document.getElementById("ciopClimaStamp");
    if (!root || !data) return;

    var meta = climaPorCodigo(data.code, data.isDay);
    var stale = !!(opts && opts.stale);
    root.classList.toggle("is-unavailable", false);
    root.classList.toggle("is-stale", stale);
    if (tempEl) tempEl.textContent = Number.isFinite(data.temp) ? Math.round(data.temp) + "°" : "—";
    if (rangeEl) {
      rangeEl.innerHTML =
        '<span class="ciop-clima-min"><small>Mín</small><b>' +
        grauLabel(data.min) +
        "</b></span>" +
        '<span class="ciop-clima-max"><small>Máx</small><b>' +
        grauLabel(data.max) +
        "</b></span>";
    }
    if (descEl) descEl.textContent = meta.desc;
    if (iconEl) {
      var grupo = String(meta.kind || "cloudy").replace("-night", "");
      if (grupo === "partly") grupo = "cloudy";
      if (grupo === "drizzle") grupo = "rain";
      iconEl.className = "ciop-clima-icon wx-live is-" + grupo;
      iconEl.innerHTML = iconeClimaSvg(meta.kind);
    }
    var horaObs = horaCurtaDeIso(data.observedAt);
    if (stampEl) {
      if (stale && horaObs) stampEl.textContent = "Última atualização às\u00a0" + horaObs;
      else if (horaObs) stampEl.textContent = "Atualizado às\u00a0" + horaObs;
      else stampEl.textContent = stale ? "Dados antigos" : "";
    }
    var frase = "Abrir previsão completa do tempo em Londrina. Agora: " + meta.desc + ", " + grauLabel(data.temp);
    if (stale && horaObs) frase += ". Última atualização às " + horaObs;
    root.setAttribute("aria-label", frase);
    root.title = frase;
    root.dataset.live = stale ? "stale" : "1";
  }

  function buscarClimaLondrina(force) {
    var root = document.getElementById("ciopKpiClima");
    if (!root) return Promise.resolve();
    var pacote = lerPacoteClima();
    var fresco = pacote && pacote.ts && Date.now() - pacote.ts <= CLIMA_TTL_MS;

    if (!force && fresco) {
      aplicarClima(pacote.data, { stale: false });
      return Promise.resolve(pacote.data);
    }
    if (pacote && pacote.data) aplicarClima(pacote.data, { stale: !fresco });

    var url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" +
      CLIMA_LAT +
      "&longitude=" +
      CLIMA_LON +
      "&current=temperature_2m,weather_code,is_day" +
      "&daily=temperature_2m_max,temperature_2m_min" +
      "&timezone=America%2FSao_Paulo&forecast_days=1";

    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("clima http " + res.status);
        return res.json();
      })
      .then(function (json) {
        var current = json && json.current;
        if (!current || !Number.isFinite(Number(current.temperature_2m))) throw new Error("clima sem observação atual");
        var data = {
          temp: Number(current.temperature_2m),
          code: Number(current.weather_code),
          isDay: current.is_day === 1 ? true : current.is_day === 0 ? false : undefined,
          max: Number(json?.daily?.temperature_2m_max?.[0]),
          min: Number(json?.daily?.temperature_2m_min?.[0]),
          observedAt: current.time || null,
        };
        gravarCacheClima(data);
        aplicarClima(data, { stale: false });
        return data;
      })
      .catch(function () {
        if (pacote && pacote.data) {
          aplicarClima(pacote.data, { stale: true });
          return pacote.data;
        }
        marcarClimaIndisponivel();
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
    if (window.gsap) return;
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
    if (document.documentElement.classList.contains("portal-home-2026")) return;
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

    function marcarTrecho(el, q) {
      if (!el) return;
      if (el.dataset.searchOrig == null) el.dataset.searchOrig = el.textContent || "";
      var orig = el.dataset.searchOrig;
      if (!q) {
        el.textContent = orig;
        return;
      }
      var map = [];
      var flat = "";
      for (var i = 0; i < orig.length; i++) {
        var n = orig.charAt(i).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        for (var j = 0; j < n.length; j++) map.push(i);
        flat += n;
      }
      var at = flat.indexOf(q);
      el.textContent = "";
      if (at < 0) {
        el.appendChild(document.createTextNode(orig));
        return;
      }
      var start = map[at];
      var end = map[at + q.length - 1] + 1;
      el.appendChild(document.createTextNode(orig.slice(0, start)));
      var mark = document.createElement("mark");
      mark.textContent = orig.slice(start, end);
      el.appendChild(mark);
      el.appendChild(document.createTextNode(orig.slice(end)));
    }

    function aplicar() {
      limparAutofillIndevido();
      const q = norm(input.value);
      if (clearBtn) clearBtn.hidden = !q;

      document.querySelectorAll(".grid .card").forEach(function (card) {
        if (card.hidden && !card.classList.contains("ciop-search-hidden")) return;
        const sec = card.closest(".card-section");
        if (document.documentElement.classList.contains("portal-home-2026") && sec && sec.hidden) {
          card.classList.remove("ciop-search-hidden", "ciop-search-hit");
          marcarTrecho(card.querySelector(".card-title"), "");
          marcarTrecho(card.querySelector(".card-desc"), "");
          return;
        }
        const titleEl = card.querySelector(".card-title");
        const descEl = card.querySelector(".card-desc");
        const title = titleEl?.textContent || "";
        const desc = descEl?.textContent || "";
        const hit = !q || norm(title + " " + desc).includes(q);
        card.classList.toggle("ciop-search-hidden", !hit);
        card.classList.toggle("ciop-search-hit", !!(q && hit));
        marcarTrecho(titleEl, q);
        marcarTrecho(descEl, q);
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

  function forcarFundoClaro() {
    /* Tema claro/escuro fica a cargo do theme-toggle. */
  }

  function init() {
    garantirWallpaper();
    ensureIconGradient();
    enhanceDuotoneIcons();
    ensureHud();
    bindModuleSearch();
    atualizarCommandCenter();
    staggerCards();
    bindRipples();
    bindFlashSalvar();
    ligarContagemPagina();
    setInterval(atualizarCommandCenter, 1000);
    iniciarClimaCommandCenter();
    iniciarKpiPresenca();
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
