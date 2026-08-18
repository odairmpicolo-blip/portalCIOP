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

  function placeDock() {
    if (window.matchMedia("(max-width: 900px)").matches) {
      dock.style.top = "";
      dock.style.maxHeight = "";
      return;
    }
    var avisos = document.querySelector(".notice-board");
    var top = 220;
    if (avisos) {
      top = Math.round(avisos.getBoundingClientRect().bottom + 10);
    }
    dock.style.top = top + "px";
    dock.style.maxHeight = "calc(100dvh - " + (top + 16) + "px)";
  }

  placeDock();
  window.addEventListener("resize", placeDock);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(placeDock);
  }
})();
