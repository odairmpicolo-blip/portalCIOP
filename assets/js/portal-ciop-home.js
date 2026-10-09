(function () {
  var tabs = document.getElementById("portalAbas");
  if (!tabs || document.querySelector(".portal-dock")) return;

  var dock = document.createElement("aside");
  dock.className = "portal-dock";
  dock.setAttribute("aria-label", "Áreas do portal");

  var areas = document.createElement("p");
  areas.className = "portal-dock-label";
  areas.textContent = "Áreas";

  tabs.parentNode.insertBefore(dock, tabs);
  dock.appendChild(areas);
  dock.appendChild(tabs);
  document.body.classList.add("portal-dock-on");

  function findAvisos() {
    var nodes = document.querySelectorAll(".notice-board");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].closest("#avisosPopup, .avisos-popup-backdrop, .avisos-popup")) continue;
      return nodes[i];
    }
    return null;
  }

  function placeDock() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      dock.style.top = "";
      dock.style.bottom = "";
      dock.style.height = "";
      dock.style.maxHeight = "";
      dock.style.removeProperty("--dock-tab-size");
      return;
    }

    var avisos = findAvisos();
    var topPx = avisos
      ? Math.round(avisos.getBoundingClientRect().bottom) + 10
      : 230;
    var bottomGap = 12;
    var avail = Math.max(160, window.innerHeight - topPx - bottomGap);
    /* Operação (8) + Dashboards (10) + Relatórios (10), com um pouco de respiro. */
    var letterUnits = 32;
    var fontPx = Math.max(7, Math.min(12, Math.floor((avail - 36) / letterUnits)));

    dock.style.top = topPx + "px";
    dock.style.bottom = bottomGap + "px";
    dock.style.height = avail + "px";
    dock.style.maxHeight = avail + "px";
    dock.style.setProperty("--dock-tab-size", fontPx + "px");
  }

  placeDock();
  window.addEventListener("resize", placeDock);
  window.addEventListener("scroll", placeDock, { passive: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(placeDock);
  }
  window.setTimeout(placeDock, 120);
  window.setTimeout(placeDock, 600);
})();
