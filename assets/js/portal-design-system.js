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
  style.href = new URL('assets/css/portal-design-system.css?v=20261026legivel1', root).href;
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
  brand();
  menu();
  window.addEventListener('dk-theme-change', brand);
  window.addEventListener('portal:usuario-validado', function () { brand(); menu(); });
  document.addEventListener('load', function (event) {
    if (event.target.matches?.('img.portal-brand-art')) brand();
  }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
