(function () {
  var PAGINAS = [
    { file: "onibus-agora.html", label: "Ônibus" },
    { file: "onibus-horarios.html", label: "Horários" },
    { file: "fleetbus-agora.html", label: "FleetBus" },
    { file: "terminais-agora.html", label: "Terminais" }
  ];

  function arquivoAtual() {
    return (window.location.pathname.split("/").pop() || "").split("?")[0];
  }

  function garantir() {
    var atual = arquivoAtual();
    if (!PAGINAS.some(function (p) { return p.file === atual; })) return;
    if (document.querySelector("[data-portal-live-nav]")) return;
    var nav = document.createElement("nav");
    nav.className = "portal-mod-nav";
    nav.dataset.portalLiveNav = "1";
    nav.setAttribute("aria-label", "Tempo real");
    nav.innerHTML = PAGINAS.map(function (p) {
      var ativo = p.file === atual ? " aria-current=\"page\"" : "";
      return "<a href=\"" + p.file + "\"" + ativo + ">" + p.label + "</a>";
    }).join("");
    var alvo = document.querySelector("main.container, main, .wrap, .shell") || document.body;
    alvo.insertBefore(nav, alvo.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", garantir);
  } else {
    garantir();
  }
  window.addEventListener("portal:usuario-validado", garantir);
})();
