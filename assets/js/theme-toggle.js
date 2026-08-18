var DK_KEY = "dk-theme";
var DK_BRAND_LIGHT = "logomarca-portalciop-tcgl-claro.png";
var DK_BRAND_DARK = "logomarca-portalciop-tcgl-escuro.png";
var DK_AUTO_TIMER = null;
/** Escurece a partir das 18h; clareia a partir das 6h (horário local). */
var DK_AUTO_DARK_FROM = 18;
var DK_AUTO_LIGHT_FROM = 6;

function dkNormalize(pref) {
  if (pref === "dark" || pref === "auto") return pref;
  return "light";
}

function dkStoredPref() {
  var stored = localStorage.getItem(DK_KEY);
  if (stored == null) return "auto";
  return dkNormalize(stored);
}

function dkPreferDarkByTime(date) {
  var d = date || new Date();
  var h = d.getHours();
  return h >= DK_AUTO_DARK_FROM || h < DK_AUTO_LIGHT_FROM;
}

function dkResolveMode(pref) {
  var p = dkNormalize(pref);
  if (p === "auto") return dkPreferDarkByTime() ? "dark" : "light";
  return p;
}

function dkIsDark(pref) {
  return dkResolveMode(pref || dkStoredPref()) === "dark";
}

function dkTcglPath(img, fileName) {
  var src = img.getAttribute("src") || "";
  if (src.indexOf("-login.png") !== -1) {
    fileName = fileName.replace(".png", "-login.png");
  }
  if (src.indexOf("../assets/") !== -1) return "../assets/img/" + fileName + "?v=20260818logo4";
  if (src.indexOf("assets/") !== -1) return "assets/img/" + fileName + "?v=20260818logo4";
  return fileName;
}

function dkSwapBrandLogos(isDark) {
  var fileName = isDark ? DK_BRAND_DARK : DK_BRAND_LIGHT;
  var imgs = document.querySelectorAll(
    "img.portal-brand-art, img[src*='logomarca-portalciop-tcgl'], img[src*='titulo-portal-ciop']"
  );
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    img.setAttribute("src", dkTcglPath(img, fileName));
    img.setAttribute("alt", "Portal CIOP TCGL Operações");
  }
}

function dkSwapTcglLogos(isDark) {
  dkSwapBrandLogos(isDark);
}

function dkPrefLabel(pref) {
  if (pref === "dark") return "Tema escuro";
  if (pref === "auto") return "Automático";
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
  if (dkStoredPref() !== "auto") return;
  DK_AUTO_TIMER = window.setInterval(function () {
    if (dkStoredPref() !== "auto") {
      dkClearAutoTimer();
      return;
    }
    dkApply("auto", true);
  }, 60 * 1000);
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
  localStorage.setItem(DK_KEY, p);
  dkApply(p);
}

(function dkBoot() {
  var stored = localStorage.getItem(DK_KEY);
  if (stored == null) {
    stored = "auto";
    localStorage.setItem(DK_KEY, stored);
  }
  var mode = dkNormalize(stored);
  if (stored !== mode) localStorage.setItem(DK_KEY, mode);
  dkApply(mode);
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
