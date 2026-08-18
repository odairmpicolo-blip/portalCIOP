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
})();
