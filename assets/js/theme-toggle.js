/* Apply the stored theme before paint when this file is in <head>. */
(function dkEarlyBoot() {
  try {
    var key = "dk-theme";
    var stored = localStorage.getItem(key);
    if (stored !== "dark" && stored !== "light" && stored !== "auto") stored = "auto";
    var dark = stored === "dark" || (stored === "auto" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var html = document.documentElement;
    html.classList.remove("dk-light", "dk-dark");
    html.classList.add(dark ? "dk-dark" : "dk-light");
    html.setAttribute("data-dk-pref", stored);
    html.setAttribute("data-dk-resolved", dark ? "dark" : "light");
  } catch (e) {}
})();

(function dkFavicon() {
  if (document.querySelector('link[rel="icon"], link[rel="shortcut icon"]')) return;
  var current = document.currentScript;
  var href = "assets/img/portal-favicon.png?v=20261026fav1";
  if (current && current.src) href = new URL("../img/portal-favicon.png?v=20261026fav1", current.src).href;
  var link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.sizes = "32x32";
  link.href = href;
  document.head.appendChild(link);
})();

var DK_KEY = "dk-theme";
var DK_BRAND_LIGHT = "portal-logo-clean-light.png";
var DK_BRAND_DARK = "portal-logo-clean-dark.png";
var DK_AUTO_TIMER = null;
var DK_SYSTEM_MQ = null;

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

function dkPreferDarkBySystem() {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch (e) {
    return false;
  }
}

function dkResolveMode(pref) {
  var p = dkNormalize(pref);
  if (p === "auto") return dkPreferDarkBySystem() ? "dark" : "light";
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
    u.search = "v=20261026chrome2";
    return u.href;
  } catch (e) {
    var src = img.getAttribute("src") || "";
    if (src.indexOf("../assets/") !== -1) return "../assets/img/" + fileName + "?v=20261026chrome2";
    if (src.charAt(0) === "/" || src.indexOf("http") === 0) return src.replace(/[^/]+(\?.*)?$/, fileName + "?v=20261026chrome2");
    if (src.indexOf("assets/") !== -1) return "assets/img/" + fileName + "?v=20261026chrome2";
    return fileName;
  }
}

function dkSwapBrandLogos(isDark) {
  var fileName = isDark ? DK_BRAND_DARK : DK_BRAND_LIGHT;
  var imgs = document.querySelectorAll(
    "img.portal-brand-art, img.home-logo, img[src*='portal-logo-clean-'], img[src*='logomarca-portalciop-tcgl']"
  );
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    var src = img.getAttribute("src") || "";
    if (img.classList.contains("portal-loading-logo")) continue;
    if (img.closest(".portal-loading-overlay, #portalLoading, .portal-loading")) continue;
    if (/titulo-portal-ciop|campanha|cartao-aniversario|print-only|pdf-/.test(src)) continue;
    if (img.closest(".pdf-sheet-top, .pdf-doc-brand, .pdf-print, .print-only, [data-print-brand]")) continue;
    img.setAttribute("src", dkTcglPath(img, fileName));
    img.setAttribute("alt", "Portal CIOP TCGL Operações");
  }
}

function dkSwapTcglLogos(isDark) {
  dkSwapBrandLogos(isDark);
}

function dkPrefLabel(pref) {
  if (pref === "dark") return "Tema escuro";
  if (pref === "auto") return "Automático (sistema)";
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
    window.clearInterval(DK_AUTO_TIMER);
    DK_AUTO_TIMER = null;
  }
}

function dkScheduleAuto() {
  dkClearAutoTimer();
  try {
    if (!DK_SYSTEM_MQ && window.matchMedia) {
      DK_SYSTEM_MQ = window.matchMedia("(prefers-color-scheme: dark)");
      var onSys = function () {
        if (dkStoredPref() === "auto") dkApply("auto", true);
      };
      if (DK_SYSTEM_MQ.addEventListener) DK_SYSTEM_MQ.addEventListener("change", onSys);
      else if (DK_SYSTEM_MQ.addListener) DK_SYSTEM_MQ.addListener(onSys);
    }
  } catch (e) {}
  if (dkStoredPref() !== "auto") return;
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
  if (document.querySelector('script[data-portal-design-system]')) return;
  var current = document.currentScript;
  if (!current?.src) return;
  var script = document.createElement('script');
  script.src = new URL('portal-design-system.js?v=20261026read1', current.src).href;
  script.dataset.portalDesignSystem = '1';
  script.defer = true;
  document.head.appendChild(script);
})();

window.addEventListener("portal:usuario-validado", function () { dkApply(dkStoredPref()); });
