(function () {
  const RODAPE_HTML =
    '<footer class="portal-site-footer"><div class="footer-inner"><span class="footer-text">© 2026 CIOP - Todos os direitos reservados</span></div></footer>';

  function cssPath() {
    const inPages = window.location.pathname.includes("/pages/");
    return inPages ? "../assets/css/portal-footer.css" : "assets/css/portal-footer.css";
  }

  function ensureCss() {
    if (document.querySelector("link[data-portal-footer]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssPath();
    link.dataset.portalFooter = "1";
    document.head.appendChild(link);
  }

  function padronizarRodape() {
    ensureCss();
    const footers = document.querySelectorAll("body footer");
    if (footers.length) {
      const last = footers[footers.length - 1];
      footers.forEach((footer) => {
        if (footer !== last) footer.remove();
      });
      if (!last.classList.contains("portal-site-footer")) {
        last.outerHTML = RODAPE_HTML;
      } else {
        last.innerHTML =
          '<div class="footer-inner"><span class="footer-text">© 2026 CIOP - Todos os direitos reservados</span></div>';
      }
      return;
    }
    document.body.insertAdjacentHTML("beforeend", RODAPE_HTML);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", padronizarRodape);
  } else {
    padronizarRodape();
  }
})();
