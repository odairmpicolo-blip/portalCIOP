var DK_KEY = 'dk-theme';

function dkApply(pref){
  var html = document.documentElement;
  html.classList.remove('dk-light', 'dk-dark');
  if (pref === 'light') html.classList.add('dk-light');
  if (pref === 'dark') html.classList.add('dk-dark');
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
}

document.addEventListener('DOMContentLoaded', dkInit);
