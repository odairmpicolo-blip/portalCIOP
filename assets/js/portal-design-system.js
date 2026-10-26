/* Shared presentation only. Authentication and page layouts remain owned by each module. */
(function () {
  var script = document.currentScript;
  var root = new URL('../../', script.src);
  function init() {
  var html = document.documentElement;
  if (html.classList.contains('portal-home-2026')) return;
  var kiosk = !!document.querySelector('#kiosk, .kiosk');
  html.classList.add(kiosk ? 'portal-glass-kiosk' : 'portal-glass-system');
  if (!html.id) html.id = 'portal-page-glass';
  if (!document.body.id) document.body.id = 'portal-page-content';
  var style = document.createElement('link');
  style.rel = 'stylesheet';
  if (!document.querySelector('link[data-portal-tokens]')) {
    var tokens = document.createElement('link');
    tokens.rel = 'stylesheet';
    tokens.href = new URL('assets/css/portal-tokens.css?v=20261026sel1', root).href;
    tokens.dataset.portalTokens = '1';
    document.head.appendChild(tokens);
  }
  style.href = new URL('assets/css/portal-design-system.css?v=20261026sel1', root).href;
  style.dataset.portalDesign = '1';
  document.head.appendChild(style);
  function brand() {
    var dark = html.classList.contains('dk-dark') || kiosk;
    var src = new URL('assets/img/portal-logo-clean-' + (dark ? 'dark' : 'light') + '.png', root).href;
    document.querySelectorAll('img.portal-brand-art').forEach(function (img) {
      if (img.src !== src) img.src = src;
    });
  }
  function menu() {
    var icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    document.querySelectorAll('.menu-toggle').forEach(function (btn) {
      if (kiosk) return;
      btn.innerHTML = icon;
      btn.dataset.portalMenu = '1';
      if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', 'Abrir menu');
    });
  }
  function themePicker() {
    if (kiosk) return;
    if (document.querySelector('.dk-theme-picker, .dk-theme-opt')) return;
    var host = document.querySelector('.header-actions') || document.querySelector('.header');
    if (!host) return;
    var box = document.createElement('div');
    box.className = 'dk-theme-picker';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Tema da interface');
    box.innerHTML =
      '<button type="button" class="dk-theme-opt" data-dk-pref="light" aria-label="Tema claro">Claro</button>' +
      '<button type="button" class="dk-theme-opt" data-dk-pref="auto" aria-label="Tema automático">Auto</button>' +
      '<button type="button" class="dk-theme-opt" data-dk-pref="dark" aria-label="Tema escuro">Escuro</button>';
    host.insertBefore(box, host.firstChild);
    var pref = document.documentElement.getAttribute('data-dk-pref') || 'auto';
    box.querySelectorAll('.dk-theme-opt').forEach(function (btn) {
      var on = btn.getAttribute('data-dk-pref') === pref;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.addEventListener('click', function () {
        if (window.dkSetPref) window.dkSetPref(btn.getAttribute('data-dk-pref'));
      });
    });
  }
  function dedupePortalIcons() {
    document.querySelectorAll('a.btn-portal, a.portal-return, [data-portal-voltar]').forEach(function (a) {
      var icons = a.querySelectorAll('.btn-icon');
      for (var i = 1; i < icons.length; i++) icons[i].remove();
    });
  }
  function chartInk() {
    if (!window.Chart || !Chart.defaults) return;
    var dark = html.classList.contains('dk-dark');
    Chart.defaults.color = dark ? '#d5e3f4' : '#3a5270';
    Chart.defaults.borderColor = dark ? 'rgba(179,212,243,.16)' : 'rgba(16,44,83,.12)';
    if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
      Chart.defaults.plugins.legend.labels.color = Chart.defaults.color;
    }
    if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
      Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(6,16,30,.94)';
      Chart.defaults.plugins.tooltip.titleColor = '#f5f8ff';
      Chart.defaults.plugins.tooltip.bodyColor = '#f5f8ff';
    }
  }
  brand();
  menu();
  themePicker();
  dedupePortalIcons();
  chartInk();
  window.addEventListener('dk-theme-change', function () { brand(); chartInk(); });
  window.addEventListener('load', chartInk);
  window.addEventListener('portal:usuario-validado', function () { brand(); menu(); themePicker(); dedupePortalIcons(); chartInk(); });
  document.addEventListener('load', function (event) {
    if (event.target.matches?.('img.portal-brand-art')) brand();
  }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
