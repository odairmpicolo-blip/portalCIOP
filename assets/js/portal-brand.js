(function () {
  const BRAND_LABEL = "Portal CIOP TCGL Operações";

  function homeHref() {
    return window.location.pathname.includes("/pages/") ? "../index.html" : "index.html";
  }

  function brandInnerHtml() {
    return (
      '<span class="portal-brand-name">Portal CIOP</span>' +
      '<span class="portal-brand-meta">TCGL · Operações</span>'
    );
  }

  function isPrintContext(el) {
    return Boolean(
      el.closest(".pdf-sheet-top, .pdf-doc-brand, .pdf-print, .print-only, [data-print-brand]")
    );
  }

  function aplicarMarca(host, asLink) {
    if (!host || host.dataset.portalBrandDone) return;
    host.dataset.portalBrandDone = "1";
    host.classList.add("portal-brand-mark");
    host.setAttribute("aria-label", BRAND_LABEL);
    if (asLink && host.tagName === "A") {
      host.href = homeHref();
    }
    host.innerHTML = brandInnerHtml();
  }

  function modernizarMarcaPortal() {
    document.querySelectorAll(".header-brand").forEach((wrap) => aplicarMarca(wrap, false));

    document.querySelectorAll(".login-brand-v2").forEach((wrap) => {
      if (wrap.dataset.portalBrandDone) return;
      wrap.dataset.portalBrandDone = "1";
      wrap.classList.add("portal-brand-mark", "portal-brand-mark--center");
      wrap.setAttribute("aria-label", BRAND_LABEL);
      wrap.querySelectorAll("img").forEach((img) => img.remove());
      wrap.querySelectorAll("p").forEach((p) => {
        if (/acesso operacional/i.test(p.textContent || "")) p.remove();
      });
      if (!wrap.querySelector(".portal-brand-name")) {
        wrap.innerHTML = brandInnerHtml();
      }
    });

    document.querySelectorAll("img.logo-ciop, img.brand-title-art, img.login-title-art-v2").forEach((img) => {
      if (isPrintContext(img)) return;
      const linkParent = img.closest("a");
      const host = linkParent || img.parentElement;
      if (!host || host.dataset.portalBrandDone) return;

      if (linkParent) {
        aplicarMarca(linkParent, true);
        img.remove();
        return;
      }

      const mark = document.createElement("div");
      mark.className = "portal-brand-mark";
      mark.setAttribute("aria-label", BRAND_LABEL);
      mark.innerHTML = brandInnerHtml();
      mark.dataset.portalBrandDone = "1";
      img.replaceWith(mark);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", modernizarMarcaPortal, { once: true });
  } else {
    modernizarMarcaPortal();
  }
})();
