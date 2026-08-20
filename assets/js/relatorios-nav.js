(function () {
  var PAGINAS = [
    { file: "relatorios.html", label: "Catálogo" },
    { file: "criar-relatorio.html", label: "Criar" },
    { file: "liberacao-relatorio.html", label: "Liberação" },
    { file: "folha-servico-relatorio.html", label: "Folha" },
    { file: "relatorio-ocorrencia.html", label: "Ocorrência" }
  ];

  function arquivoAtual() {
    return (window.location.pathname.split("/").pop() || "").split("?")[0];
  }

  function garantir() {
    var atual = arquivoAtual();
    if (!PAGINAS.some(function (p) { return p.file === atual; })) return;
    if (document.querySelector("[data-portal-rel-nav]")) return;
    var nav = document.createElement("nav");
    nav.className = "portal-mod-nav";
    nav.dataset.portalRelNav = "1";
    nav.setAttribute("aria-label", "Módulo de relatórios");
    nav.innerHTML = PAGINAS.map(function (p) {
      var ativo = p.file === atual ? " aria-current=\"page\"" : "";
      return "<a href=\"" + p.file + "\"" + ativo + ">" + p.label + "</a>";
    }).join("");
    var alvo = document.querySelector("main.container, main, .wrap") || document.body;
    alvo.insertBefore(nav, alvo.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", garantir);
  } else {
    garantir();
  }
  window.addEventListener("portal:usuario-validado", garantir);
})();
