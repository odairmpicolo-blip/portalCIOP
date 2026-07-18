var DK_KEY = 'dk-theme';
var DK_TCGL_LIGHT = 'LOGO_TCGL-removebg-preview.png';
var DK_TCGL_DARK = 'LOGO_TCGL-dark.png';

function dkIsDark(pref){
  var p = pref || localStorage.getItem(DK_KEY) || 'auto';
  if (p === 'dark') return true;
  if (p === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
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

function dkApply(pref){
  var html = document.documentElement;
  html.classList.remove('dk-light', 'dk-dark');
  if (pref === 'light') html.classList.add('dk-light');
  if (pref === 'dark') html.classList.add('dk-dark');
  if (pref === 'auto') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) html.classList.add('dk-dark');
    else html.classList.add('dk-light');
  }
  dkSwapTcglLogos(dkIsDark(pref));
}

dkApply(localStorage.getItem(DK_KEY) || 'auto');

function dkOnToggleClick(){
  var current = localStorage.getItem(DK_KEY) || 'auto';
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDarkNow = current === 'dark' || (current === 'auto' && prefersDark);
  var next = isDarkNow ? 'light' : 'dark';
  localStorage.setItem(DK_KEY, next);
  dkApply(next);
}

function dkInit(){
  var toggles = document.querySelectorAll('.dk-theme-toggle');
  for (var i = 0; i < toggles.length; i++){
    toggles[i].addEventListener('click', dkOnToggleClick);
  }
  dkSwapTcglLogos(dkIsDark());
}

document.addEventListener('DOMContentLoaded', dkInit);
