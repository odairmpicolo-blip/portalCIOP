/* Overlay 3D compartilhado (home e páginas internas). */
(function () {
  if (document.getElementById("kiosk")) return;
  if (document.body && document.body.classList.contains("login-v2")) return;
  if (document.querySelector(".portal-fx-3d")) return;

  var wrap = document.createElement("div");
  wrap.className = "portal-fx-3d";
  wrap.setAttribute("aria-hidden", "true");
  wrap.innerHTML =
    '<div class="portal-fx-3d-ceil"></div>' +
    '<div class="portal-fx-3d-floor"></div>' +
    '<div class="portal-fx-3d-scan"></div>' +
    '<svg class="portal-fx-3d-lines" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" focusable="false">' +
      '<defs>' +
        '<linearGradient id="fxLineAzul" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#38bdf8" stop-opacity="0"/>' +
          '<stop offset="35%" stop-color="#38bdf8" stop-opacity=".85"/>' +
          '<stop offset="100%" stop-color="#06245c" stop-opacity=".1"/>' +
        "</linearGradient>" +
        '<linearGradient id="fxLineLaranja" x1="1" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#ff6b00" stop-opacity="0"/>' +
          '<stop offset="40%" stop-color="#ff6b00" stop-opacity=".8"/>' +
          '<stop offset="100%" stop-color="#ffb347" stop-opacity=".05"/>' +
        "</linearGradient>" +
      "</defs>" +
      '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path stroke="url(#fxLineAzul)" stroke-width="1" d="M80 120 L260 120 L320 220 L520 220 L560 80 L820 80"/>' +
        '<path stroke="url(#fxLineAzul)" stroke-width="1.2" d="M40 420 L180 360 L180 240 L340 240"/>' +
        '<path stroke="url(#fxLineLaranja)" stroke-width="1.5" d="M1360 90 L1180 90 L1120 180 L980 180 L940 60"/>' +
        '<path stroke="url(#fxLineLaranja)" stroke-width="1.2" d="M1400 380 L1260 320 L1260 210 L1100 210"/>' +
        '<path stroke="url(#fxLineAzul)" stroke-width="1" d="M720 40 L720 160 L860 200 L1020 200"/>' +
        '<path stroke="url(#fxLineLaranja)" stroke-width="1" d="M200 760 L360 680 L640 680 L760 560"/>' +
        '<path stroke="url(#fxLineAzul)" stroke-width="1.1" d="M90 640 L90 520 L220 480 L220 400"/>' +
        '<path stroke="url(#fxLineLaranja)" stroke-width="1.1" d="M1350 640 L1350 500 L1220 460 L1220 380"/>' +
        '<circle cx="260" cy="120" r="3.2" fill="#38bdf8"/>' +
        '<circle cx="320" cy="220" r="2.6" fill="#7dd3fc"/>' +
        '<circle cx="1180" cy="90" r="3.2" fill="#ff6b00"/>' +
        '<circle cx="1120" cy="180" r="2.6" fill="#ffb347"/>' +
        '<circle cx="180" cy="360" r="2.4" fill="#38bdf8"/>' +
        '<circle cx="640" cy="680" r="2.4" fill="#ff6b00"/>' +
      "</g>" +
    "</svg>";

  var host = document.body;
  if (!host) return;
  host.insertBefore(wrap, host.firstChild);
})();
