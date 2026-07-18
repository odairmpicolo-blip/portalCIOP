var DK_KEY = 'dk-theme';
var DK_TCGL_LIGHT = 'LOGO_TCGL-removebg-preview.png';
var DK_TCGL_DARK = 'LOGO_TCGL-dark.png';

function dkNormalize(pref){
  if (pref === 'dark') return 'dark';
  return 'light';
}

function dkIsDark(pref){
  return dkNormalize(pref || localStorage.getItem(DK_KEY)) === 'dark';
}

function dkTcglPath(img, fileName){
  var src = img.getAttribute('src') || '';
  if (src.indexOf('../assets/') !== -1) return '../assets/img/' + fileName;
  if (src.indexOf('assets/') !== -1) return 'assets/img/' + fileName;
  return fileName;
}

function dkSwapTcglLogos(isDark){
  var fileName = isDark ? DK_TCGL_DARK : DK_TCGL_LIGHT;
  var imgs = document.querySelectorAll(
    'img.logo-tcgl, img.logo-right, img[src*="LOGO_TCGL-removebg"], img[src*="LOGO_TCGL-dark"]'
  );
  for (var i = 0; i < imgs.length; i++){
    var img = imgs[i];
    img.setAttribute('src', dkTcglPath(img, fileName));
    img.classList.toggle('logo-tcgl-dark-mode', !!isDark);
  }
}

function dkSyncLabels(isDark){
  var labels = document.querySelectorAll('.dk-theme-label, #dkThemeLabel');
  for (var i = 0; i < labels.length; i++){
    labels[i].textContent = isDark ? 'Tema claro' : 'Tema escuro';
  }
  var toggles = document.querySelectorAll('.dk-theme-toggle');
  for (var j = 0; j < toggles.length; j++){
    toggles[j].setAttribute(
      'aria-label',
      isDark ? 'Ativar tema claro' : 'Ativar tema escuro'
    );
    toggles[j].setAttribute(
      'title',
      isDark ? 'Tema claro' : 'Tema escuro'
    );
  }
}

function dkApply(pref){
  var mode = dkNormalize(pref);
  var html = document.documentElement;
  html.classList.remove('dk-light', 'dk-dark');
  html.classList.add(mode === 'dark' ? 'dk-dark' : 'dk-light');
  dkSwapTcglLogos(mode === 'dark');
  dkSyncLabels(mode === 'dark');
}

(function dkBoot(){
  var stored = localStorage.getItem(DK_KEY);
  var mode = dkNormalize(stored);
  if (stored !== mode) localStorage.setItem(DK_KEY, mode);
  dkApply(mode);
})();

function dkOnToggleClick(){
  var next = dkIsDark() ? 'light' : 'dark';
  localStorage.setItem(DK_KEY, next);
  dkApply(next);
}

function dkInit(){
  var toggles = document.querySelectorAll('.dk-theme-toggle');
  for (var i = 0; i < toggles.length; i++){
    toggles[i].addEventListener('click', dkOnToggleClick);
  }
  dkSwapTcglLogos(dkIsDark());
  dkSyncLabels(dkIsDark());
}

document.addEventListener('DOMContentLoaded', dkInit);
