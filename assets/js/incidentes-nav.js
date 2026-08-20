(function () {
  var PAGINAS = [
    { file: "incidentes-dashboard.html", label: "TCGL" },
    { file: "incidentes-cad.html", label: "CAD" },
    { file: "incidentes-analise.html", label: "Análise" },
    { file: "relatorio-ocorrencia.html", label: "Ocorrência" }
  ];

  function arquivoAtual() {
    return (window.location.pathname.split("/").pop() || "").split("?")[0];
  }

  function garantirNavIncidentes() {
    var atual = arquivoAtual();
    if (!PAGINAS.some(function (p) { return p.file === atual; })) return;
    if (document.querySelector("[data-portal-inc-nav]")) return;
    var nav = document.createElement("nav");
    nav.className = "portal-incidentes-nav";
    nav.dataset.portalIncNav = "1";
    nav.setAttribute("aria-label", "Módulo de incidentes");
    nav.innerHTML = PAGINAS.map(function (p) {
      var ativo = p.file === atual ? " aria-current=\"page\"" : "";
      return "<a href=\"" + p.file + "\"" + ativo + ">" + p.label + "</a>";
    }).join("");
    var alvo = document.querySelector("main.container, main, .wrap") || document.body;
    alvo.insertBefore(nav, alvo.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", garantirNavIncidentes);
  } else {
    garantirNavIncidentes();
  }
  window.addEventListener("portal:usuario-validado", garantirNavIncidentes);
})();
