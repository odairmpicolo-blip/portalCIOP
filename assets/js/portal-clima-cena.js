(function (w) {
  var TZ = "America/Sao_Paulo";
  var FALLBACK_DAY_START = 6;
  var FALLBACK_DAY_END = 18;
  var periodoTimer = 0;
  var pulsoTimer = 0;
  var ultimoFlip = null;
  var ultimoPayload = null;

  /* Vento da Open-Meteo neste painel vem em km/h (padrão da API, sem wind_speed_unit).
     Forte: sustentado ≥ 40 km/h ou rajada ≥ 60 km/h. Não troca chuva nem tempestade. */
  var VENTO_FORTE_KMH = 40;
  var RAJADA_FORTE_KMH = 60;
  var LUA_NOVA_REF = Date.UTC(2000, 0, 6, 18, 14, 0);
  var LUA_SINODICO_MS = 29.530588853 * 24 * 60 * 60 * 1000;
  var luaSeq = 0;

  function grupoClima(code) {
    var c = Number(code);
    if (!isFinite(c)) return "neutral";
    if (c === 0 || c === 1) return "sun";
    if (c === 2) return "partly";
    if (c === 3) return "cloud";
    if (c === 45 || c === 48) return "fog";
    if ([71, 73, 75, 77, 85, 86].indexOf(c) >= 0) return "snow";
    if ([95, 96, 99].indexOf(c) >= 0) return "storm";
    if ([51, 53, 55, 56, 57].indexOf(c) >= 0) return "drizzle";
    if ([61, 63, 65, 66, 67, 80, 81, 82].indexOf(c) >= 0) return "rain";
    return "cloud";
  }

  function ventoForte(speed, gust) {
    var s = Number(speed);
    var g = Number(gust);
    return (isFinite(s) && s >= VENTO_FORTE_KMH) || (isFinite(g) && g >= RAJADA_FORTE_KMH);
  }

  function faseLua(ms) {
    var t = ms == null ? Date.now() : Number(ms);
    if (!isFinite(t)) return null;
    var x = (t - LUA_NOVA_REF) / LUA_SINODICO_MS;
    return x - Math.floor(x);
  }

  function parseIsoSp(iso) {
    if (iso == null || iso === "") return NaN;
    var s = String(iso).replace(" ", "T");
    if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).getTime();
    if (s.length === 10) s += "T12:00:00";
    if (s.length === 16) s += ":00";
    return new Date(s + "-03:00").getTime();
  }

  function wallParts(ms) {
    var fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    var map = {};
    fmt.formatToParts(new Date(ms)).forEach(function (p) {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    var hour = Number(map.hour);
    if (hour === 24) hour = 0;
    return {
      date: map.year + "-" + map.month + "-" + map.day,
      hour: hour,
      minute: Number(map.minute),
      second: Number(map.second)
    };
  }

  function flagDia(v) {
    if (v === 1 || v === true || v === "1") return true;
    if (v === 0 || v === false || v === "0") return false;
    return null;
  }

  function solarDoInstante(atMs, dates, sunrises, sunsets) {
    if (!dates || !sunrises || !sunsets || atMs == null) return { rise: NaN, set: NaN };
    var dia = wallParts(atMs).date;
    var i = dates.indexOf(dia);
    if (i < 0) {
      for (var k = 0; k < dates.length; k += 1) {
        if (String(dates[k]).slice(0, 10) === dia) {
          i = k;
          break;
        }
      }
    }
    if (i < 0) return { rise: NaN, set: NaN };
    return { rise: parseIsoSp(sunrises[i]), set: parseIsoSp(sunsets[i]) };
  }

  function ehDia(opts) {
    opts = opts || {};
    var at = opts.atMs != null ? opts.atMs : Date.now();
    var rise = opts.sunriseMs != null ? opts.sunriseMs : NaN;
    var set = opts.sunsetMs != null ? opts.sunsetMs : NaN;
    if ((!(rise > 0) || !(set > 0)) && opts.dates) {
      var pair = solarDoInstante(at, opts.dates, opts.sunrises, opts.sunsets);
      rise = pair.rise;
      set = pair.set;
    }
    /* Coluna de uma hora: o is_day da Open-Meteo vale para o início daquela hora.
       O instante "agora" e a cena usam nascer/pôr da data, senão o sol fica
       na tela depois das 18:35 enquanto a hora 18 ainda vem marcada como dia. */
    var flagged = flagDia(opts.isDay != null ? opts.isDay : opts.is_day);
    if (opts.horaCheia && flagged !== null) return flagged;
    if (rise > 0 && set > 0) return at >= rise && at < set;
    if (flagged !== null) return flagged;
    var parts = wallParts(at);
    var minutes = parts.hour * 60 + parts.minute;
    return minutes >= FALLBACK_DAY_START * 60 && minutes < FALLBACK_DAY_END * 60;
  }

  function svgSun() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><g class="wx-sun-rays"><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g><circle class="wx-sun-core" cx="12" cy="12" r="4" fill="rgba(250,204,21,.4)"/></svg>';
  }
  /* Fase 0 = lua nova, 0,5 = cheia. Londrina fica no hemisfério sul: crescente ilumina à esquerda. */
  function luaMarkup(phase) {
    var p = phase == null ? NaN : Number(phase);
    if (!isFinite(p)) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.1" fill="#d5deea"/></svg>';
    }
    p = ((p % 1) + 1) % 1;
    if (p < 0.03 || p > 0.97) {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.1" fill="#64748b" opacity=".5"/></svg>';
    }
    var rx = Math.max(0.35, Math.abs(Math.cos(p * 2 * Math.PI)) * 7.1).toFixed(2);
    var waxing = p < 0.5;
    var gibbous = Math.cos(p * 2 * Math.PI) < 0;
    /* Sul: crescente à esquerda. Gibosa usa o arco interno no sentido oposto, para não virar uma lasca. */
    var outer = waxing ? 0 : 1;
    var inner = gibbous ? 1 - outer : outer;
    var d = "M12 4.9 A7.1 7.1 0 0 " + outer + " 12 19.1 A" + rx + " 7.1 0 0 " + inner + " 12 4.9 Z";
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="wx-moon" cx="12" cy="12" r="7.1" fill="#1e293b"/><path class="wx-moon" d="' + d + '" fill="#e8eef6"/></svg>';
  }
  function svgMoon(phase) {
    return luaMarkup(phase);
  }
  function svgPartlyDay() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="wx-sun-core" cx="9" cy="9" r="3.2" fill="rgba(250,204,21,.45)" stroke="#facc15" stroke-width="1.6"/><path class="wx-cloud" d="M8 18h9.2a3.4 3.4 0 0 0 0-6.8 5.2 5.2 0 0 0-9.6-1.1A3 3 0 0 0 8 18z" fill="rgba(186,230,253,.22)" stroke="#e2e8f0" stroke-width="1.6"/></svg>';
  }
  function svgPartlyNight(phase) {
    return '<span class="wx-ico-stack">' + luaMarkup(phase) + svgCloud() + "</span>";
  }
  function svgCloud() {
    return '<svg viewBox="0 0 24 24" fill="rgba(186,230,253,.2)" stroke="#7dd3fc" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="wx-cloud" d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3-1.5A3.5 3.5 0 0 0 7 18z"/></svg>';
  }
  function svgRain() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path class="wx-cloud" d="M7 16h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3-1.5A3.5 3.5 0 0 0 7 16z" fill="rgba(186,230,253,.18)"/><path class="wx-drop" d="M8 19v2" stroke="#38bdf8"/><path class="wx-drop" d="M12 18v3" stroke="#38bdf8"/><path class="wx-drop" d="M16 19v2" stroke="#38bdf8"/></svg>';
  }
  function svgStorm() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="wx-cloud" d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3-1.5A3.5 3.5 0 0 0 7 15z" fill="rgba(186,230,253,.18)"/><path class="wx-bolt" d="M11 15l-2 4h3l-1 3" stroke="#facc15"/></svg>';
  }
  function svgFog() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path class="wx-fog-line" d="M4 10h16"/><path class="wx-fog-line" d="M6 14h12"/><path class="wx-fog-line" d="M8 18h8"/></svg>';
  }
  function svgSnow() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path class="wx-cloud" d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3-1.5A3.5 3.5 0 0 0 7 14z" fill="rgba(226,232,240,.2)"/><circle class="wx-flake" cx="8.5" cy="18.5" r="1" fill="#e2e8f0"/><circle class="wx-flake" cx="12" cy="19.5" r="1.1" fill="#e2e8f0"/><circle class="wx-flake" cx="15.5" cy="18.5" r="1" fill="#e2e8f0"/></svg>';
  }

  function iconeMarkup(code, isDay, atMs) {
    var grupo = grupoClima(code);
    var dia = isDay !== false;
    var fase = dia ? null : faseLua(atMs);
    if (grupo === "sun") return dia ? svgSun() : svgMoon(fase);
    if (grupo === "partly") return dia ? svgPartlyDay() : svgPartlyNight(fase);
    if (grupo === "drizzle" || grupo === "rain") return svgRain();
    if (grupo === "storm") return svgStorm();
    if (grupo === "fog") return svgFog();
    if (grupo === "snow") return svgSnow();
    if (grupo === "neutral") return svgCloud();
    return svgCloud();
  }

  function climaSvg(code, extraClass, isDay, atMs) {
    var grupo = grupoClima(code);
    var period = isDay === false ? "night" : "day";
    return (
      '<span class="tv-wx wx-live ' +
      (extraClass || "") +
      '" data-wx="' +
      grupo +
      '" data-period="' +
      period +
      '">' +
      iconeMarkup(code, isDay !== false, atMs) +
      "</span>"
    );
  }

  function gotas(qtd) {
    var html = "";
    var i;
    for (i = 0; i < qtd; i += 1) {
      var left = ((i * 3.7) + (i % 5) * 1.4) % 100;
      html += '<i class="wx-raindrop" style="left:' + left + "%;height:" + (10 + (i % 5) * 3) + '%"></i>';
    }
    return html;
  }

  function estrelas() {
    return '<div class="wx-stars" aria-hidden="true"></div>';
  }

  function discoLua(phase) {
    return '<div class="wx-moon-disc">' + luaMarkup(phase) + "</div>";
  }

  function cenaHtml(grupo, isDay, vento, phase) {
    var noite = isDay === false;
    var nuvens = '<div class="wx-cloud-mass c1"></div><div class="wx-cloud-mass c2"></div>';
    if (grupo === "neutral") {
      return '<div class="wx-sky"></div><div class="wx-haze"></div>';
    }
    if (grupo === "sun") {
      if (noite) {
        return (
          '<div class="wx-sky"></div>' +
          estrelas() +
          discoLua(phase) +
          (vento ? nuvens : '<div class="wx-cloud-soft c2"></div>') +
          '<div class="wx-haze"></div>'
        );
      }
      return (
        '<div class="wx-sky"></div><div class="wx-sun"></div>' +
        '<div class="wx-cloud-soft c1"></div><div class="wx-cloud-soft c2"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "partly") {
      if (noite) {
        return '<div class="wx-sky"></div>' + estrelas() + discoLua(phase) + nuvens + '<div class="wx-haze"></div>';
      }
      return '<div class="wx-sky"></div><div class="wx-sun is-soft"></div>' + nuvens + '<div class="wx-haze"></div>';
    }
    if (grupo === "cloud") {
      return (
        '<div class="wx-sky"></div>' +
        (noite ? discoLua(phase) : "") +
        nuvens +
        '<div class="wx-cloud-mass c3"></div><div class="wx-haze"></div>'
      );
    }
    if (grupo === "drizzle") {
      return '<div class="wx-sky"></div>' + nuvens + '<div class="wx-rain is-fine">' + gotas(8) + '</div><div class="wx-haze"></div>';
    }
    if (grupo === "rain") {
      return '<div class="wx-sky"></div>' + nuvens + '<div class="wx-cloud-mass c4"></div><div class="wx-rain">' + gotas(14) + '</div><div class="wx-haze"></div>';
    }
    if (grupo === "storm") {
      return (
        '<div class="wx-sky"></div>' + nuvens +
        '<div class="wx-cloud-mass c4"></div><div class="wx-glow"></div>' +
        '<div class="wx-rain is-heavy">' + gotas(16) + '</div><div class="wx-haze"></div>'
      );
    }
    if (grupo === "fog") {
      return '<div class="wx-sky"></div><div class="wx-fog-bank b1"></div><div class="wx-fog-bank b2"></div><div class="wx-fog-bank b3"></div><div class="wx-haze"></div>';
    }
    return '<div class="wx-sky"></div><div class="wx-cloud-mass c1"></div><div class="wx-snow"></div><div class="wx-haze"></div>';
  }

  function marcarCenaClima(code, fxId, isDay, extras) {
    extras = extras || {};
    var fx = document.getElementById(fxId);
    var neutro = extras.neutro === true || code == null || code === "" || !isFinite(Number(code));
    var grupo = neutro ? "neutral" : grupoClima(code);
    var dia = !neutro && isDay !== false;
    var noite = !dia && !neutro;
    var vento = !neutro && ventoForte(extras.vento != null ? extras.vento : extras.wind, extras.rajada != null ? extras.rajada : extras.gust);
    var phase = noite ? faseLua(extras.atMs) : null;
    var scene = fx && (fx.closest(".wx") || fx.closest(".tv-card-weather"));
    if (scene) {
      scene.setAttribute("data-wx", grupo);
      scene.setAttribute("data-period", neutro ? "neutral" : (dia ? "day" : "night"));
      scene.classList.toggle("is-wind", vento);
    }
    if (!fx) return;
    var chave = grupo + (neutro ? "-z" : (dia ? "-d" : "-n")) + (vento ? "-w" : "") + (noite ? "-p" + Math.round((phase || 0) * 20) : "");
    if (fx.dataset.grupo === chave) return;
    fx.dataset.grupo = chave;
    fx.className = "wx-fx is-" + grupo + (neutro ? "" : (dia ? " is-day" : " is-night")) + (vento ? " is-wind" : "") + " is-in";
    fx.innerHTML = cenaHtml(grupo, dia, vento, phase);
  }

  function proximosSolares(dates, sunrises, sunsets) {
    var now = Date.now();
    var times = [];
    var i;
    for (i = 0; i < (sunrises || []).length; i += 1) {
      times.push(parseIsoSp(sunrises[i]));
      times.push(parseIsoSp(sunsets[i]));
    }
    times = times.filter(function (t) {
      return t > now + 4000;
    }).sort(function (a, b) {
      return a - b;
    });
    return times[0] || 0;
  }

  function agendarPeriodo(daily, onFlip) {
    if (typeof onFlip === "function") ultimoFlip = onFlip;
    if (periodoTimer) w.clearTimeout(periodoTimer);
    if (!pulsoTimer) {
      pulsoTimer = w.setInterval(function () {
        if (typeof ultimoFlip === "function") ultimoFlip();
      }, 30 * 1000);
    }
    if (!daily || typeof onFlip !== "function") return;
    var next = proximosSolares(daily.time, daily.sunrise, daily.sunset);
    if (!next) return;
    var wait = Math.max(next - Date.now(), 1000);
    periodoTimer = w.setTimeout(function () {
      onFlip();
      agendarPeriodo(daily, onFlip);
    }, wait);
  }

  w.portalClimaTz = TZ;
  w.portalGrupoClima = grupoClima;
  w.portalClimaVentoForte = ventoForte;
  w.portalClimaFaseLua = faseLua;
  w.portalClimaParseIso = parseIsoSp;
  w.portalClimaEhDia = ehDia;
  w.portalClimaSvg = climaSvg;
  w.portalClimaIcone = iconeMarkup;
  w.portalMarcarCenaClima = marcarCenaClima;
  w.portalClimaAgendarPeriodo = agendarPeriodo;
  w.portalClimaGuardarPayload = function (data) {
    ultimoPayload = data || null;
  };
  w.portalClimaUltimoPayload = function () {
    return ultimoPayload;
  };

  /* A TV fica aberta o dia inteiro. À meia-noite de Londrina a página
     recarrega com um endereço novo, para pegar o HTML e o script atuais. */
  function agendarViradaDoDia() {
    var diaAberto = wallParts(Date.now()).date;
    var recarregando = false;
    function virar(agora) {
      if (recarregando) return false;
      var dia = wallParts(agora == null ? Date.now() : agora).date;
      if (dia === diaAberto) return false;
      recarregando = true;
      try {
        var u = new URL(w.location.href);
        u.searchParams.set("_d", dia);
        w.location.replace(u.href);
      } catch (e) {
        w.location.reload();
      }
      return true;
    }
    function armar() {
      var parts = wallParts(Date.now());
      var passados = ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000;
      var falta = 24 * 60 * 60 * 1000 - passados;
      w.setTimeout(function () {
        if (!virar()) armar();
      }, Math.max(falta, 1000));
    }
    w.setInterval(function () { virar(); }, 15000);
    armar();
  }
  agendarViradaDoDia();
})(window);
