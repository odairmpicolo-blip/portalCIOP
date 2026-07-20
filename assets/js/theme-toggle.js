var DK_KEY = "dk-theme";
var DK_TCGL_LIGHT = "LOGO_TCGL-removebg-preview.png";
var DK_TCGL_DARK = "LOGO_TCGL-dark.png";
var DK_AUTO_TIMER = null;
/** Escurece a partir das 18h; clareia a partir das 6h (horário local). */
var DK_AUTO_DARK_FROM = 18;
var DK_AUTO_LIGHT_FROM = 6;

function dkNormalize(pref) {
  if (pref === "dark" || pref === "auto") return pref;
  return "light";
}

function dkStoredPref() {
  return dkNormalize(localStorage.getItem(DK_KEY));
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
  if (src.indexOf("../assets/") !== -1) return "../assets/img/" + fileName;
  if (src.indexOf("assets/") !== -1) return "assets/img/" + fileName;
  return fileName;
}

function dkSwapTcglLogos(isDark) {
  var fileName = isDark ? DK_TCGL_DARK : DK_TCGL_LIGHT;
  var imgs = document.querySelectorAll(
    'img.logo-tcgl, img.logo-right, img[src*="LOGO_TCGL-removebg"], img[src*="LOGO_TCGL-dark"]'
  );
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    img.setAttribute("src", dkTcglPath(img, fileName));
    img.classList.toggle("logo-tcgl-dark-mode", !!isDark);
  }
}

function dkPrefLabel(pref) {
  if (pref === "dark") return "Tema escuro";
  if (pref === "auto") return "Automático";
  return "Tema claro";
}

function dkNextPref(pref) {
  if (pref === "light") return "dark";
  if (pref === "dark") return "auto";
  return "light";
}

function dkSyncLabels(pref, isDark) {
  var p = dkNormalize(pref);
  var label = dkPrefLabel(p);
  var next = dkPrefLabel(dkNextPref(p));
  var labels = document.querySelectorAll(".dk-theme-label, #dkThemeLabel");
  for (var i = 0; i < labels.length; i++) {
    labels[i].textContent = label;
  }
  var toggles = document.querySelectorAll(".dk-theme-toggle");
  for (var j = 0; j < toggles.length; j++) {
    toggles[j].setAttribute("data-dk-pref", p);
    toggles[j].setAttribute(
      "aria-label",
      "Tema atual: " + label + ". Clique para " + next.toLowerCase()
    );
    toggles[j].setAttribute("title", label + " · próximo: " + next);
  }
  document.documentElement.setAttribute("data-dk-pref", p);
  document.documentElement.setAttribute("data-dk-resolved", isDark ? "dark" : "light");
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
  dkSwapTcglLogos(isDark);
  dkSyncLabels(p, isDark);
  if (!silent) dkScheduleAuto();
}

(function dkBoot() {
  var stored = localStorage.getItem(DK_KEY);
  var mode = dkNormalize(stored);
  if (stored !== mode) localStorage.setItem(DK_KEY, mode);
  dkApply(mode);
})();

function dkOnToggleClick(ev) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }
  var next = dkNextPref(dkStoredPref());
  localStorage.setItem(DK_KEY, next);
  dkApply(next);
}

function dkInit() {
  var toggles = document.querySelectorAll(".dk-theme-toggle");
  for (var i = 0; i < toggles.length; i++) {
    toggles[i].removeEventListener("click", dkOnToggleClick);
    toggles[i].addEventListener("click", dkOnToggleClick);
  }
  dkApply(dkStoredPref());
  window.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && dkStoredPref() === "auto") {
      dkApply("auto");
    }
  });
}

document.addEventListener("DOMContentLoaded", dkInit);
