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
      dock.style.maxHeight = "";
      return;
    }
    var avisos = findAvisos();
    if (avisos) {
      var bottom = Math.round(avisos.getBoundingClientRect().bottom);
      dock.style.top = "calc(" + bottom + "px + 2cm)";
      dock.style.maxHeight = "calc(100dvh - (" + bottom + "px + 2cm + 16px))";
      return;
    }
    dock.style.top = "calc(220px + 2cm)";
    dock.style.maxHeight = "calc(100dvh - 220px - 2cm - 16px)";
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
