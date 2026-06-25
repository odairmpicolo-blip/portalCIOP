(function () {
  const BRAND_LABEL = "Portal CIOP TCGL Operações";

  function homeHref() {
    return window.location.pathname.includes("/pages/") ? "../index.html" : "index.html";
  }

  function brandInnerHtml() {
    return (
      '<span class="portal-brand-name">Portal CI<span class="portal-brand-o">O</span>P</span>' +
      '<span class="portal-brand-meta">TCGL · Operações</span>'
    );
  }

  function isPrintContext(el) {
    return Boolean(
      el.closest(".pdf-sheet-top, .pdf-doc-brand, .pdf-print, .print-only, [data-print-brand]")
    );
  }

  function aplicarMarca(host, asLink) {
    if (!host) return;
    host.classList.add("portal-brand-mark");
    host.setAttribute("aria-label", BRAND_LABEL);
    if (asLink && host.tagName === "A") {
      host.href = homeHref();
      host.removeAttribute("target");
      host.removeAttribute("rel");
    }
    host.innerHTML = brandInnerHtml();
    host.dataset.portalBrandDone = "1";
  }

  function modernizarMarcaPortal() {
    document.querySelectorAll(".header-brand, .portal-brand-mark").forEach((wrap) => {
      if (isPrintContext(wrap)) return;
      aplicarMarca(wrap, wrap.tagName === "A");
    });

    document.querySelectorAll(".login-brand-v2, .login-brand").forEach((wrap) => {
      if (wrap.dataset.portalBrandDone) return;
      wrap.classList.add("portal-brand-mark", "portal-brand-mark--center");
      wrap.querySelectorAll("img").forEach((img) => img.remove());
      wrap.querySelectorAll("p").forEach((p) => {
        if (/acesso operacional/i.test(p.textContent || "")) p.remove();
      });
      aplicarMarca(wrap, false);
    });

    document.querySelectorAll("img.logo-ciop, img.brand-title-art, img.login-title-art-v2").forEach((img) => {
      if (isPrintContext(img)) return;
      const linkParent = img.closest("a");
      if (linkParent && !linkParent.classList.contains("portal-brand-mark")) {
        aplicarMarca(linkParent, true);
        img.remove();
        return;
      }
      if (img.classList.contains("portal-brand-mark")) return;
      const mark = document.createElement(linkParent ? "a" : "div");
      aplicarMarca(mark, Boolean(linkParent));
      if (linkParent) {
        linkParent.replaceWith(mark);
      } else {
        img.replaceWith(mark);
      }
    });
  }

  window.modernizarMarcaPortal = modernizarMarcaPortal;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", modernizarMarcaPortal, { once: true });
  } else {
    modernizarMarcaPortal();
  }
})();
