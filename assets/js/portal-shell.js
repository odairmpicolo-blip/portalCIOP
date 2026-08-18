/* Casco compartilhado: marca | título | sessão. Roda antes do auth.js. */
(function () {
  if (document.getElementById("portalAbas")) return;
  if (document.body && document.body.classList.contains("login-v2")) return;
  if (document.getElementById("kiosk")) return;

  const header = document.querySelector("header.header, div.header, .header");
  if (!header || header.getAttribute("data-portal-shell") === "off") return;

  const inPages = window.location.pathname.includes("/pages/");
  const base = inPages ? "../" : "";

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const h1 = header.querySelector("h1");
  const title = ((h1 && h1.textContent) || document.title.split(/[·|—-]/)[0] || "Portal CIOP").trim();
  const sub = header.querySelector(".subtitle, .header-subtitle");
  const subHtml = sub ? sub.outerHTML : "";

  const session = header.querySelector(".ciop-session");
  const sessionHtml = session
    ? session.outerHTML
    : '<div class="ciop-session" aria-label="Sessão do usuário">' +
      '<span id="usuarioLogado" class="ciop-session-user">Usuário</span>' +
      '<span id="perfilUsuario" class="ciop-session-cargo" hidden></span>' +
      '<button data-portal-senha-btn="1" onclick="toggleSenhaPanel()" class="btn-senha-portal" type="button">Senha</button>' +
      '<button onclick="logout()" class="btn-logout" type="button">Sair</button>' +
      "</div>";

  const actions = header.querySelector(".header-actions");
  const extras = [];
  if (actions) {
    Array.from(actions.children).forEach(function (el) {
      if (el.classList.contains("ciop-session")) return;
      if (el.classList.contains("logo-tcgl-link")) return;
      if (el.classList.contains("logo") || el.classList.contains("logo-right") || el.classList.contains("logo-tcgl")) return;
      if (el.matches && el.matches("a") && el.querySelector(".logo-tcgl, .logo, .logo-right")) return;
      extras.push(el.outerHTML);
    });
  }

  header.classList.add("portal-shell-header");
  header.innerHTML =
    '<div class="portal-brand-lockup">' +
      '<a class="portal-brand-mark" href="' + base + 'index.html" aria-label="Portal CIOP TCGL Operações">' +
        '<img class="portal-brand-art" src="' + base + 'assets/img/titulo-portal-ciop.png" alt="Portal CIOP">' +
        '<span class="portal-brand-meta">TCGL · Operações</span>' +
      "</a>" +
      '<a href="https://www.tcgrandelondrina.com.br/" target="_blank" rel="noopener" class="logo-tcgl-link" aria-label="Site TCGL">' +
        '<img class="logo-tcgl" src="' + base + 'assets/img/LOGO_TCGL-dark.png" alt="TCGL">' +
      "</a>" +
    "</div>" +
    '<div class="portal-shell-title">' +
      '<h1 class="header-title portal-letterbox">' + esc(title) + "</h1>" +
      subHtml +
    "</div>" +
    '<div class="header-actions">' +
      sessionHtml +
      extras.join("") +
    "</div>";

  var subEl = header.querySelector(".subtitle, .header-subtitle");
  if (subEl) subEl.classList.add("portal-letterbox-sub");
})();
