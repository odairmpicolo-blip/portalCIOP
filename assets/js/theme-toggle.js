var DK_LAT = -23.3104;
var DK_LON = -51.1628;
var DK_TZ = "America/Sao_Paulo";

function dkSpParts(at) {
  var map = {};
  new Intl.DateTimeFormat("en-GB", {
    timeZone: DK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(at || new Date()).forEach(function (part) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  });
  return map;
}

function dkSolarMinutes(year, month, day, rising) {
  var n1 = Math.floor((275 * month) / 9);
  var n2 = Math.floor((month + 9) / 12);
  var n3 = 1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3);
  var n = n1 - n2 * n3 + day - 30;
  var lngHour = DK_LON / 15;
  var t = n + ((rising ? 6 : 18) - lngHour) / 24;
  var M = 0.9856 * t - 3.289;
  var L = M + 1.916 * Math.sin((M * Math.PI) / 180) + 0.02 * Math.sin((2 * M * Math.PI) / 180) + 282.634;
  L = ((L % 360) + 360) % 360;
  var RA = (Math.atan(0.91764 * Math.tan((L * Math.PI) / 180)) * 180) / Math.PI;
  RA = ((RA % 360) + 360) % 360;
  RA = RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90);
  RA = RA / 15;
  var sinDec = 0.39782 * Math.sin((L * Math.PI) / 180);
  var cosDec = Math.cos(Math.asin(sinDec));
  var cosH =
    (Math.cos((90.833 * Math.PI) / 180) - sinDec * Math.sin((DK_LAT * Math.PI) / 180)) /
    (cosDec * Math.cos((DK_LAT * Math.PI) / 180));
  if (cosH > 1) return 6 * 60;
  if (cosH < -1) return 18 * 60;
  var H = rising ? 360 - (Math.acos(cosH) * 180) / Math.PI : (Math.acos(cosH) * 180) / Math.PI;
  H = H / 15;
  var UT = H + RA - 0.06571 * t - 6.622 - lngHour;
  var local = ((UT - 3) % 24 + 24) % 24;
  return Math.round(local * 60);
}

function dkPreferDarkBySun(at) {
  try {
    var p = dkSpParts(at);
    var now = p.hour * 60 + p.minute;
    var rise = dkSolarMinutes(p.year, p.month, p.day, true);
    var set = dkSolarMinutes(p.year, p.month, p.day, false);
    if (!Number.isFinite(rise) || !Number.isFinite(set)) return p.hour < 6 || p.hour >= 18;
    return now < rise || now >= set;
  } catch (e) {
    try {
      var h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: DK_TZ, hour: "numeric", hourCycle: "h23" }).format(at || new Date()));
      return h < 6 || h >= 18;
    } catch (e2) {
      return false;
    }
  }
}

function dkMsUntilSunSwitch(at) {
  var p = dkSpParts(at);
  var now = p.hour * 60 + p.minute;
  var rise = dkSolarMinutes(p.year, p.month, p.day, true);
  var set = dkSolarMinutes(p.year, p.month, p.day, false);
  var next = now < rise ? rise : now < set ? set : rise + 24 * 60;
  var waitMin = next - now;
  var waitMs = waitMin * 60 * 1000 - p.second * 1000;
  return Math.min(Math.max(waitMs + 800, 1000), 6 * 60 * 60 * 1000);
}

function dkIsKioskPage() {
  try {
    var path = String(location.pathname || "");
    if (/painel-ciop|painel-tv|performance-tempo-real/.test(path)) return true;
    if (document.getElementById("kiosk") || document.querySelector(".kiosk")) return true;
  } catch (e) {}
  return false;
}

/* Apply the stored theme before paint when this file is in <head>. */
(function dkEarlyBoot() {
  if (dkIsKioskPage()) return;
  try {
    var key = "dk-theme";
    var stored = localStorage.getItem(key);
    if (stored !== "dark" && stored !== "light" && stored !== "auto") stored = "auto";
    var dark = stored === "dark" || (stored === "auto" && dkPreferDarkBySun());
    var html = document.documentElement;
    html.classList.remove("dk-light", "dk-dark");
    html.classList.add(dark ? "dk-dark" : "dk-light");
    html.setAttribute("data-dk-pref", stored);
    html.setAttribute("data-dk-resolved", dark ? "dark" : "light");
    var script = document.currentScript;
    var imgBase = script && script.src ? new URL("../img/", script.src).href : "assets/img/";
    ["portal-ciop-claro.png", "portal-ciop-escuro.png"].forEach(function (file) {
      var link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = imgBase + file + "?v=20261029logo1";
      document.head.appendChild(link);
    });
  } catch (e) {}
})();

(function dkWatchBrand() {
  if (dkIsKioskPage()) return;
  function scan(node) {
    if (!node) return;
    if (node.nodeName === "IMG") dkBrandApplyImg(node);
    if (!node.querySelectorAll) return;
    var list = node.querySelectorAll("img.portal-brand-art, img.home-logo, img.login-corner-logo");
    for (var i = 0; i < list.length; i++) dkBrandApplyImg(list[i]);
  }
  if (document.body) scan(document);
  var mo = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var nodes = records[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) scan(nodes[j]);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

(function dkFavicon() {
  if (document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')) return;
  var current = document.currentScript;
  var href = "assets/img/portal-favicon.png?v=20261029fav2";
  if (current && current.src) href = new URL("../img/portal-favicon.png?v=20261029fav2", current.src).href;
  var link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.sizes = "32x32";
  link.href = href;
  document.head.appendChild(link);
})();

var DK_KEY = "dk-theme";
var DK_BRAND_LIGHT = "portal-ciop-claro.png";
var DK_BRAND_DARK = "portal-ciop-escuro.png";
var DK_BRAND_VER = "v=20261029logo1";
var DK_AUTO_TIMER = null;

function dkNormalize(pref) {
  if (pref === "dark" || pref === "auto") return pref;
  return "light";
}

function dkPreferenceKey() {
  var email = String(window.portalUsuario?.email || '').trim().toLowerCase();
  return email ? DK_KEY + ':' + encodeURIComponent(email) : DK_KEY;
}

function dkStoredPref() {
  var stored = localStorage.getItem(dkPreferenceKey());
  if (stored == null) stored = localStorage.getItem(DK_KEY);
  if (stored == null) return "auto";
  return dkNormalize(stored);
}

function dkResolveMode(pref) {
  var p = dkNormalize(pref);
  if (p === "auto") return dkPreferDarkBySun() ? "dark" : "light";
  return p;
}

function dkIsDark(pref) {
  return dkResolveMode(pref || dkStoredPref()) === "dark";
}

function dkTcglPath(img, fileName) {
  try {
    var resolved = img.currentSrc || img.src || img.getAttribute("src") || "";
    var u = new URL(resolved, location.href);
    u.pathname = u.pathname.replace(/[^/]+$/, fileName);
    u.search = DK_BRAND_VER;
    return u.href;
  } catch (e) {
    var src = img.getAttribute("src") || "";
    if (src.indexOf("../assets/") !== -1) return "../assets/img/" + fileName + "?" + DK_BRAND_VER;
    if (src.charAt(0) === "/" || src.indexOf("http") === 0) return src.replace(/[^/]+(\?.*)?$/, fileName + "?" + DK_BRAND_VER);
    if (src.indexOf("assets/") !== -1) return "assets/img/" + fileName + "?" + DK_BRAND_VER;
    return fileName + "?" + DK_BRAND_VER;
  }
}

function dkBrandSkip(img) {
  if (!img || img.nodeName !== "IMG") return true;
  if (dkIsKioskPage()) return true;
  if (img.classList.contains("portal-loading-logo") || img.classList.contains("ciop-intro-logo-light") || img.classList.contains("ciop-intro-logo-dark")) return true;
  if (img.classList.contains("logo-ciop") || img.classList.contains("logo-tcgl") || img.classList.contains("kiosk-logo") || img.classList.contains("campanha-logo") || img.classList.contains("logo-big") || img.classList.contains("scene-ciop")) return true;
  if (img.closest("#kiosk, .kiosk, .portal-loading-overlay, #portalLoading, .portal-loading")) return true;
  if (img.closest(".pdf-sheet-top, .pdf-doc-brand, .pdf-print, .print-only, [data-print-brand]")) return true;
  var src = img.getAttribute("src") || "";
  if (/titulo-portal-ciop|campanha|cartao-aniversario|print-only|pdf-|logo-ciop|LOGO_TCGL|logo-tcgl/i.test(src)) return true;
  return false;
}

function dkBrandIsPortal(img) {
  if (img.classList.contains("portal-brand-art") || img.classList.contains("home-logo") || img.classList.contains("login-corner-logo")) return true;
  var src = img.getAttribute("src") || "";
  return /portal-ciop-claro|portal-ciop-escuro|portal-logo-clean-|logomarca-portalciop-tcgl/.test(src);
}

function dkBrandApplyImg(img) {
  if (dkBrandSkip(img) || !dkBrandIsPortal(img)) return;
  var fileName = document.documentElement.classList.contains("dk-dark") ? DK_BRAND_DARK : DK_BRAND_LIGHT;
  var href = img.getAttribute("src") || img.src || "";
  if (href.indexOf(fileName) !== -1 && href.indexOf("20261029logo1") !== -1) {
    if (!img.getAttribute("width")) img.setAttribute("width", "1024");
    if (!img.getAttribute("height")) img.setAttribute("height", "349");
    return;
  }
  var next = dkTcglPath(img, fileName);
  img.setAttribute("src", next);
  img.src = next;
  img.setAttribute("alt", "Portal CIOP TCGL Operações");
  img.setAttribute("width", "1024");
  img.setAttribute("height", "349");
}

function dkSwapBrandLogos() {
  var imgs = document.querySelectorAll(
    "img.portal-brand-art, img.home-logo, img.login-corner-logo, img[src*='portal-ciop-'], img[src*='portal-logo-clean-'], img[src*='logomarca-portalciop-tcgl']"
  );
  for (var i = 0; i < imgs.length; i++) dkBrandApplyImg(imgs[i]);
}

function dkSwapTcglLogos(isDark) {
  dkSwapBrandLogos(isDark);
}

function dkPrefLabel(pref) {
  if (pref === "dark") return "Tema escuro";
  if (pref === "auto") return "Automático (dia/noite)";
  return "Tema claro";
}

function dkSyncPicker(pref) {
  var p = dkNormalize(pref);
  var opts = document.querySelectorAll(".dk-theme-opt");
  for (var i = 0; i < opts.length; i++) {
    var btn = opts[i];
    var active = btn.getAttribute("data-dk-pref") === p;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }
  var labels = document.querySelectorAll(".dk-theme-label, #dkThemeLabel");
  for (var j = 0; j < labels.length; j++) {
    labels[j].textContent = dkPrefLabel(p);
  }
  document.documentElement.setAttribute("data-dk-pref", p);
}

function dkClearAutoTimer() {
  if (DK_AUTO_TIMER) {
    window.clearTimeout(DK_AUTO_TIMER);
    DK_AUTO_TIMER = null;
  }
}

function dkScheduleAuto() {
  dkClearAutoTimer();
  if (dkStoredPref() !== "auto") return;
  try {
    DK_AUTO_TIMER = window.setTimeout(function () {
      DK_AUTO_TIMER = null;
      if (dkStoredPref() === "auto") dkApply("auto");
    }, dkMsUntilSunSwitch());
  } catch (e) {}
}

function dkApply(pref, silent) {
  var p = dkNormalize(pref);
  var mode = dkResolveMode(p);
  var isDark = mode === "dark";
  var html = document.documentElement;
  html.classList.remove("dk-light", "dk-dark");
  html.classList.add(isDark ? "dk-dark" : "dk-light");
  html.setAttribute("data-dk-resolved", isDark ? "dark" : "light");
  dkSwapTcglLogos(isDark);
  dkSyncPicker(p);
  if (!silent) dkScheduleAuto();
  try {
    window.dispatchEvent(new CustomEvent("dk-theme-change", { detail: { dark: isDark, pref: p } }));
  } catch (e) {}
}

function dkSetPref(pref) {
  var p = dkNormalize(pref);
  localStorage.setItem(dkPreferenceKey(), p);
  dkApply(p);
}

(function dkBoot() {
  if (dkIsKioskPage()) return;
  var stored = dkStoredPref();
  try {
    if (localStorage.getItem(DK_KEY) == null) localStorage.setItem(DK_KEY, stored);
  } catch (e) {}
  dkApply(stored, true);
  dkScheduleAuto();
})();

function dkOnOptClick(ev) {
  var btn = ev.currentTarget;
  if (!btn) return;
  ev.preventDefault();
  ev.stopPropagation();
  dkSetPref(btn.getAttribute("data-dk-pref"));
}

function dkInit() {
  if (dkIsKioskPage()) return;
  var opts = document.querySelectorAll(".dk-theme-opt");
  for (var i = 0; i < opts.length; i++) {
    opts[i].removeEventListener("click", dkOnOptClick);
    opts[i].addEventListener("click", dkOnOptClick);
  }
  // Compat: se ainda existir o botão antigo, não cicla mais — ignora
  dkApply(dkStoredPref());
  window.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && dkStoredPref() === "auto") {
      dkApply("auto");
    }
  });
}

document.addEventListener("DOMContentLoaded", dkInit);

// API usada por páginas que reagem à troca de tema
window.dkSetPref = dkSetPref;
window.dkIsDark = dkIsDark;
window.dkSwapBrandLogos = dkSwapBrandLogos;

/* All standard portal pages receive the same presentation layer through this shared entry point. */
(function () {
  var current = document.currentScript;
  if (!current || !current.src) return;
  if (dkIsKioskPage()) return;
  if (!document.querySelector('script[data-portal-shell]')) {
    var shell = document.createElement('script');
    shell.src = new URL('portal-shell.js?v=20261030sess1', current.src).href;
    shell.dataset.portalShell = '1';
    shell.defer = true;
    document.head.appendChild(shell);
  }
  if (!document.querySelector('script[data-portal-design-system]')) {
    var script = document.createElement('script');
    script.src = new URL('portal-design-system.js?v=20261030wa1', current.src).href;
    script.dataset.portalDesignSystem = '1';
    script.defer = true;
    document.head.appendChild(script);
  }
})();

window.addEventListener("portal:usuario-validado", function () { dkApply(dkStoredPref()); });
