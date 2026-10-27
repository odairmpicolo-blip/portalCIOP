(function (w) {
  var TZ = "America/Sao_Paulo";
  var FALLBACK_DAY_START = 6;
  var FALLBACK_DAY_END = 18;
  var periodoTimer = 0;
  var pulsoTimer = 0;
  var ultimoFlip = null;
  var ultimoPayload = null;

  function grupoClima(code) {
    var c = Number(code);
    if (c === 0 || c === 1) return "sun";
    if (c === 2) return "partly";
    if (c === 3) return "cloud";
    if (c === 45 || c === 48) return "fog";
    if ([71, 73, 75, 77, 85, 86].indexOf(c) >= 0) return "snow";
    if ([82, 95, 96, 99].indexOf(c) >= 0) return "storm";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81].indexOf(c) >= 0) return "rain";
    return "cloud";
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
      hourCycle: "h23"
    });
    var map = {};
    fmt.formatToParts(new Date(ms)).forEach(function (p) {
      if (p.type !== "literal") map[p.type] = p.value;
    });
    return {
      date: map.year + "-" + map.month + "-" + map.day,
      hour: Number(map.hour),
      minute: Number(map.minute)
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
    /* Nascer e pôr do sol mandam. O is_day da hora inteira ainda diz "dia"
       depois das 18:35, e a cena de sol ficava na tela. */
    if (rise > 0 && set > 0) return at >= rise && at < set;
    var flagged = flagDia(opts.isDay != null ? opts.isDay : opts.is_day);
    if (flagged !== null) return flagged;
    var parts = wallParts(at);
    var minutes = parts.hour * 60 + parts.minute;
    return minutes >= FALLBACK_DAY_START * 60 && minutes < FALLBACK_DAY_END * 60;
  }

  function svgSun() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#facc15" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><g class="wx-sun-rays"><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g><circle class="wx-sun-core" cx="12" cy="12" r="4" fill="rgba(250,204,21,.4)"/></svg>';
  }
  function svgMoon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path class="wx-moon" d="M15.2 3.2a7.6 7.6 0 1 0 5.6 11.4A8.2 8.2 0 0 1 15.2 3.2z" fill="rgba(226,232,240,.92)" stroke="#e2e8f0" stroke-width="1.2"/></svg>';
  }
  function svgPartlyDay() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle class="wx-sun-core" cx="9" cy="9" r="3.2" fill="rgba(250,204,21,.45)" stroke="#facc15" stroke-width="1.6"/><path class="wx-cloud" d="M8 18h9.2a3.4 3.4 0 0 0 0-6.8 5.2 5.2 0 0 0-9.6-1.1A3 3 0 0 0 8 18z" fill="rgba(186,230,253,.22)" stroke="#e2e8f0" stroke-width="1.6"/></svg>';
  }
  function svgPartlyNight() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="wx-moon" d="M9.2 4.2a5.4 5.4 0 1 0 4.2 8.6A6 6 0 0 1 9.2 4.2z" fill="rgba(226,232,240,.9)" stroke="#e2e8f0" stroke-width="1.1"/><path class="wx-cloud" d="M8 18h9.2a3.4 3.4 0 0 0 0-6.8 5.2 5.2 0 0 0-9.6-1.1A3 3 0 0 0 8 18z" fill="rgba(186,230,253,.22)" stroke="#e2e8f0" stroke-width="1.6"/></svg>';
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

  function iconeMarkup(code, isDay) {
    var grupo = grupoClima(code);
    var dia = isDay !== false;
    if (grupo === "sun") return dia ? svgSun() : svgMoon();
    if (grupo === "partly") return dia ? svgPartlyDay() : svgPartlyNight();
    if (grupo === "rain") return svgRain();
    if (grupo === "storm") return svgStorm();
    if (grupo === "fog") return svgFog();
    if (grupo === "snow") return svgSnow();
    return svgCloud();
  }

  function climaSvg(code, extraClass, isDay) {
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
      iconeMarkup(code, isDay !== false) +
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

  function cenaHtml(grupo, isDay) {
    var noite = isDay === false;
    if (grupo === "sun") {
      if (noite) {
        return '<div class="wx-sky"></div>' + estrelas() + '<div class="wx-moon-disc"></div><div class="wx-haze"></div>';
      }
      return '<div class="wx-sky"></div><div class="wx-sun"></div><div class="wx-haze"></div>';
    }
    if (grupo === "partly") {
      if (noite) {
        return (
          '<div class="wx-sky"></div>' +
          estrelas() +
          '<div class="wx-moon-disc is-soft"></div>' +
          '<div class="wx-cloud-mass c1"></div>' +
          '<div class="wx-cloud-mass c2"></div>' +
          '<div class="wx-haze"></div>'
        );
      }
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-sun is-soft"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "cloud") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-cloud-mass c3"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "rain") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-rain">' +
        gotas(18) +
        "</div>" +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "storm") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-cloud-mass c4"></div>' +
        '<div class="wx-rain is-heavy">' +
        gotas(22) +
        "</div>" +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "fog") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-fog-bank b1"></div>' +
        '<div class="wx-fog-bank b2"></div>' +
        '<div class="wx-fog-bank b3"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    return (
      '<div class="wx-sky"></div>' +
      '<div class="wx-cloud-mass c1"></div>' +
      '<div class="wx-snow"></div>' +
      '<div class="wx-haze"></div>'
    );
  }

  function marcarCenaClima(code, fxId, isDay) {
    var fx = document.getElementById(fxId);
    var grupo = grupoClima(code);
    var dia = isDay !== false;
    var scene = fx && (fx.closest(".wx") || fx.closest(".tv-card-weather"));
    if (scene) {
      scene.setAttribute("data-wx", grupo);
      scene.setAttribute("data-period", dia ? "day" : "night");
    }
    if (!fx) return;
    var chave = grupo + (dia ? "-d" : "-n");
    if (fx.dataset.grupo === chave) return;
    fx.dataset.grupo = chave;
    fx.className = "wx-fx is-" + grupo + (dia ? " is-day" : " is-night");
    fx.innerHTML = cenaHtml(grupo, dia);
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
})(window);
