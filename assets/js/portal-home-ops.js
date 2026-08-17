/* Atalhos da home: os módulos que o usuário já vê, em botões grandes. */
(function () {
  if (!document.getElementById("portalAbas")) return;

  var PRIORIDADE = [
    "lancar-servico",
    "liberacao-lancamento",
    "terminais-agora",
    "fleetbus-agora",
    "criar-relatorio",
    "ipv",
    "icv",
    "dashboard-servico",
    "incidentes",
    "onibus-agora",
    "tabelas-horarias",
    "liberacao-dashboard"
  ];
  var MAX = 6;

  function visivel(el) {
    if (!el || el.hidden) return false;
    if (el.classList.contains("ciop-search-hidden")) return false;
    return true;
  }

  function moduloDe(el) {
    return String(el.getAttribute("data-modulo") || "").trim();
  }

  function montar() {
    var host = document.getElementById("portalAtalhos");
    if (!host) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll(".card-section a.card"));
    var escolhidos = [];
    var usados = {};

    function pegar(card) {
      if (!visivel(card) || escolhidos.length >= MAX) return;
      var key = moduloDe(card) || card.getAttribute("href") || String(escolhidos.length);
      if (usados[key]) return;
      usados[key] = true;
      escolhidos.push(card);
    }

    PRIORIDADE.forEach(function (id) {
      cards.forEach(function (card) {
        if (moduloDe(card) === id) pegar(card);
      });
    });
    cards.forEach(pegar);

    host.innerHTML = "";
    if (escolhidos.length < 2) {
      host.hidden = true;
      return;
    }
    host.hidden = false;

    var label = document.createElement("p");
    label.className = "portal-atalhos-label";
    label.textContent = "Acesso rápido";
    host.appendChild(label);

    escolhidos.forEach(function (card) {
      var a = document.createElement("a");
      a.className = "portal-atalho";
      a.href = card.getAttribute("href") || "#";
      if (card.target) a.target = card.target;
      if (a.target === "_blank") a.rel = "noopener noreferrer";

      var ico = document.createElement("span");
      ico.className = "portal-atalho-ico";
      ico.setAttribute("aria-hidden", "true");
      var fig = card.querySelector(".card-figure");
      ico.innerHTML = fig ? fig.innerHTML : "";

      var txt = document.createElement("span");
      txt.className = "portal-atalho-txt";
      var strong = document.createElement("strong");
      strong.textContent = ((card.querySelector(".card-title") || {}).textContent || "").trim() || "Módulo";
      var small = document.createElement("small");
      small.textContent = ((card.querySelector(".card-desc") || {}).textContent || "").trim();
      txt.appendChild(strong);
      if (small.textContent) txt.appendChild(small);

      a.appendChild(ico);
      a.appendChild(txt);
      host.appendChild(a);
    });
  }

  window.addEventListener("portal:usuario-validado", montar);
  window.addEventListener("portal:acessos-atualizados", montar);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.setTimeout(montar, 0);
    });
  } else {
    window.setTimeout(montar, 0);
  }
})();
