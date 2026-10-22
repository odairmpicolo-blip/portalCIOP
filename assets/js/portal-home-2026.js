(function () {
  if (!document.documentElement.classList.contains("portal-home-2026")) return;
  var homeCss = document.querySelector('link[href*="portal-home-2026.css"]');
  if (homeCss) document.head.appendChild(homeCss);

  var ICO = {
    inicio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7"/><path d="M6 10.5V20h12v-9.5"/></svg>',
    operacao: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="11" rx="2"/><path d="M7 17v2"/><path d="M17 17v2"/><path d="M3 12h18"/></svg>',
    monitoramento: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>',
    relatorios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-7"/></svg>',
    admin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/></svg>',
    servico: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    liberacao: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    relatorio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h4"/></svg>',
    sino: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 21h4"/></svg>',
    outros: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>'
  };

  function primeiroNome() {
    var el = document.getElementById("heroNomeUsuario");
    var t = el ? String(el.textContent || "").trim() : "";
    if (t && t.toLowerCase() !== "usuário" && t.toLowerCase() !== "usuario") return t;
    var u = window.portalUsuario && window.portalUsuario.nome;
    var n = String(u || "").split(/\s+/)[0];
    return n || "usuário";
  }

  function ola() {
    var s = document.getElementById("heroSaudacao");
    var n = document.getElementById("heroNomeUsuario");
    if (s) s.textContent = "Olá,";
    if (n) n.textContent = primeiroNome();
  }

  function marcarNav(alvo) {
    document.querySelectorAll(".home-nav-btn").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-home-nav") === alvo);
    });
  }

  function mostrarTodos() {
    if (typeof window.portalMostrarAbaHome === "function") window.portalMostrarAbaHome("todos", true);
    else {
      document.querySelectorAll(".card-section").forEach(function (sec) {
        sec.hidden = false;
      });
      document.querySelectorAll(".portal-aba").forEach(function (b) {
        b.setAttribute("aria-selected", b.getAttribute("data-alvo") === "todos" ? "true" : "false");
      });
    }
    marcarNav("inicio");
  }

  function clicarAba(id) {
    if (typeof window.portalMostrarAbaHome === "function") window.portalMostrarAbaHome(id, true);
    else {
      var aba = document.querySelector('.portal-aba[data-alvo="' + id + '"]');
      if (aba) aba.click();
    }
    marcarNav(id);
  }

  function montarNav() {
    var side = document.getElementById("sidebar");
    if (!side || side.querySelector(".home-nav")) return;
    var brand = document.createElement("div");
    brand.className = "home-brand";
    brand.innerHTML =
      '<img class="portal-brand-art" src="assets/img/logomarca-portalciop-tcgl-claro.png?v=20261022logo" alt="Portal CIOP TCGL Operações">' +
      '<span class="home-brand-copy"><b>Portal CIOP</b><small>TCGL · Operações</small></span>';
    var nav = document.createElement("nav");
    nav.className = "home-nav";
    nav.setAttribute("aria-label", "Áreas do portal");
    nav.innerHTML =
      '<button type="button" class="home-nav-btn is-active" data-home-nav="inicio">' + ICO.inicio + " Início</button>" +
      '<button type="button" class="home-nav-btn" data-home-nav="secaoOperacao">' + ICO.operacao + " Operação</button>" +
      '<button type="button" class="home-nav-btn" data-home-nav="secaoDashboards">' + ICO.monitoramento + " Monitoramento</button>" +
      '<button type="button" class="home-nav-btn" data-home-nav="secaoRelatorios">' + ICO.relatorios + " Relatórios</button>" +
      '<a class="home-nav-btn" data-home-nav="admin" data-modulo="gerenciar-usuarios" data-perfis="Administrador,Supervisor,Gerência,Gerencia,Secretária,Secretaria" href="pages/admin-usuarios.html">' +
      ICO.admin + " Administração</a>" +
      '<button type="button" class="home-nav-btn home-outros-btn" data-home-nav="outros" aria-expanded="false" aria-controls="homeOutros">' +
      ICO.outros + ' Outros<span class="home-outros-chevron" aria-hidden="true"></span></button>';
    var wrap = document.createElement("div");
    wrap.className = "home-side-links";
    wrap.id = "homeOutros";
    wrap.hidden = true;
    Array.prototype.slice.call(side.children).forEach(function (el) {
      if (el.classList.contains("dk-theme-picker")) return;
      if (el.classList.contains("home-nav") || el.classList.contains("home-brand")) return;
      if (el.classList.contains("sidebar-header")) {
        el.remove();
        return;
      }
      wrap.appendChild(el);
    });
    var campanha = document.createElement("div");
    campanha.className = "home-campanha-side";
    campanha.id = "homeCampanhaSide";
    var online = document.createElement("div");
    online.className = "home-online";
    online.id = "homeOnlineSide";
    var picker = side.querySelector(".dk-theme-picker");
    side.insertBefore(brand, side.firstChild);
    side.insertBefore(nav, brand.nextSibling);
    nav.appendChild(wrap);
    side.appendChild(campanha);
    side.appendChild(online);
    if (picker) side.appendChild(picker);
    nav.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-home-nav]");
      if (!btn || btn.tagName === "A") return;
      var alvo = btn.getAttribute("data-home-nav");
      if (alvo === "outros") {
        var aberto = !wrap.hidden;
        wrap.hidden = aberto;
        btn.setAttribute("aria-expanded", aberto ? "false" : "true");
        marcarNav(aberto ? "inicio" : "outros");
        return;
      }
      wrap.hidden = true;
      var outrosBtn = nav.querySelector('[data-home-nav="outros"]');
      if (outrosBtn) outrosBtn.setAttribute("aria-expanded", "false");
      if (alvo === "inicio") mostrarTodos();
      else clicarAba(alvo);
    });
    if (window.dkSwapBrandLogos) window.dkSwapBrandLogos(!!window.dkIsDark && window.dkIsDark());
    sincronizarOutros();
  }

  function sincronizarOutros() {
    var wrap = document.getElementById("homeOutros");
    var btn = document.querySelector('[data-home-nav="outros"]');
    if (!wrap || !btn) return;
    var visivel = Array.prototype.some.call(wrap.querySelectorAll(".side-link"), function (el) {
      if (el.hidden) return false;
      var st = window.getComputedStyle(el);
      return st.display !== "none" && st.visibility !== "hidden";
    });
    btn.hidden = !visivel;
    if (!visivel) {
      wrap.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  }

  function montarTopo() {
    var header = document.querySelector("header.header");
    var search = document.querySelector(".ciop-search");
    var actions = document.querySelector(".header-actions");
    if (!header || !search || header.querySelector(".home-topbar")) return;
    var bar = document.createElement("div");
    bar.className = "home-topbar";
    var lock = header.querySelector(".header-brand-lock");
    var bell = document.createElement("button");
    bell.type = "button";
    bell.className = "home-bell";
    bell.setAttribute("aria-label", "Ir para avisos");
    bell.innerHTML = ICO.sino + '<span class="home-bell-count" id="homeBellCount" data-empty="1"></span>';
    bell.addEventListener("click", function () {
      var n = document.querySelector(".notice-board");
      if (n) n.scrollIntoView({ block: "start" });
    });
    if (lock) bar.appendChild(lock);
    bar.appendChild(search);
    bar.appendChild(bell);
    if (actions) bar.appendChild(actions);
    header.insertBefore(bar, header.firstChild);
  }

  function montarMeta() {
    var hero = document.getElementById("headerHero");
    if (!hero || hero.querySelector(".home-meta")) return;
    var meta = document.createElement("div");
    meta.className = "home-meta";
    var data = document.querySelector(".ciop-kpi-data");
    var clima = document.querySelector(".ciop-kpi-clima");
    if (data) meta.appendChild(data);
    if (clima) meta.appendChild(clima);
    hero.appendChild(meta);
  }

  function atualizarCampanhaSide() {
    var dest = document.getElementById("homeCampanhaSide");
    if (!dest) return;
    var mes = document.getElementById("heroMesNome");
    var destaq = document.getElementById("heroCampanhaDestaque");
    var cons = document.getElementById("heroMesConsciencia");
    var ribbon = document.getElementById("heroRibbon");
    var nome = ((mes && mes.textContent) || "") + " " + ((destaq && destaq.textContent) || "");
    var texto = (cons && cons.textContent) || "";
    if (!nome.trim() && !texto.trim()) return;
    dest.innerHTML =
      (ribbon && ribbon.innerHTML ? ribbon.innerHTML : "") +
      "<div><strong>" +
      nome.trim() +
      "</strong><br>" +
      texto.trim() +
      "</div>";
  }

  function atualizarOnlineSide() {
    var dest = document.getElementById("homeOnlineSide");
    var chip = document.getElementById("ciopOnlineChip");
    if (!dest || !chip) return;
    dest.innerHTML = chip.innerHTML.replace("Online", "Sistema online").replace("Offline", "Sistema offline");
  }

  function atualizarSino() {
    var badge = document.getElementById("homeBellCount");
    var src = document.getElementById("ciopKpiAvisos") || document.getElementById("avisosContador");
    if (!badge || !src) return;
    var n = String(src.textContent || "").trim();
    if (!n || n === "—" || n === "0") {
      badge.textContent = "";
      badge.setAttribute("data-empty", "1");
      return;
    }
    badge.textContent = n;
    badge.removeAttribute("data-empty");
  }

  function montarAtalhos() {
    if (document.getElementById("homeQuick")) return;
    var abas = document.getElementById("portalAbas");
    if (!abas || !abas.parentNode) return;
    var wrap = document.createElement("div");
    wrap.innerHTML =
      '<div class="home-quick-head"><h2>Acessos rápidos</h2></div>' +
      '<section class="home-quick" id="homeQuick">' +
      '<a href="pages/monitoramento.html">' + ICO.monitor + "<strong>Monitoramento</strong><span>Acompanhe a operação</span></a>" +
      '<a href="pages/Folhadeservico1.html">' + ICO.servico + "<strong>Lançar serviço</strong><span>Registre um novo serviço</span></a>" +
      '<a href="pages/liberacao-lancamento.html">' + ICO.liberacao + "<strong>Liberação</strong><span>Acompanhe as liberações</span></a>" +
      '<a href="pages/criar-relatorio.html">' + ICO.relatorio + "<strong>Criar relatório</strong><span>Gere relatórios operacionais</span></a>" +
      "</section>" +
      '<div class="home-mods-head"><h2>Módulos da operação</h2></div>';
    abas.parentNode.insertBefore(wrap, abas);
  }

  function montarAbaTodos() {
    var list = document.getElementById("portalAbas");
    if (!list || list.querySelector('[data-alvo="todos"]')) return;
    var dash = list.querySelector('[data-alvo="secaoDashboards"]');
    if (dash) dash.textContent = "Monitoramento";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "portal-aba";
    btn.setAttribute("role", "tab");
    btn.setAttribute("data-alvo", "todos");
    btn.setAttribute("aria-selected", "true");
    btn.textContent = "Todos";
    var ind = list.querySelector(".portal-aba-indicador");
    if (ind && ind.nextSibling) list.insertBefore(btn, ind.nextSibling);
    else list.insertBefore(btn, list.firstChild);
    btn.addEventListener("click", mostrarTodos);
    setTimeout(mostrarTodos, 0);
  }

  function lead() {
    var copy = document.querySelector(".hero-pro-copy");
    if (!copy || copy.querySelector(".home-lead")) return;
    var p = document.createElement("p");
    p.className = "home-lead";
    p.textContent = "Sua operação em um só lugar.";
    copy.appendChild(p);
  }

  function kpiLabels() {
    var map = {
      ciopKpiModulos: { t: "Módulos disponíveis", i: ICO.monitoramento },
      ciopKpiUsuarios: { t: "Ativos agora", i: ICO.admin },
      ciopKpiAvisos: { t: "Avisos", i: ICO.sino }
    };
    Object.keys(map).forEach(function (id) {
      var num = document.getElementById(id);
      var kpi = num && num.closest(".ciop-kpi");
      if (!kpi) return;
      var lab = kpi.querySelector(".ciop-kpi-label");
      if (lab) lab.textContent = map[id].t;
      if (!kpi.querySelector(".home-kpi-ico")) {
        var ico = document.createElement("span");
        ico.className = "home-kpi-ico";
        ico.setAttribute("aria-hidden", "true");
        ico.innerHTML = map[id].i;
        kpi.insertBefore(ico, kpi.firstChild);
      }
    });
  }

  function montarSheet() {
    if (document.querySelector(".home-sheet")) return;
    var header = document.querySelector("header.header");
    var toolbar = document.querySelector(".toolbar");
    var container = document.querySelector(".container");
    if (!header || !container || !header.parentNode) return;
    var sheet = document.createElement("div");
    sheet.className = "home-sheet";
    header.parentNode.insertBefore(sheet, header);
    sheet.appendChild(header);
    if (toolbar) sheet.appendChild(toolbar);
    sheet.appendChild(container);
  }

  function iniciar() {
    montarNav();
    montarSheet();
    montarTopo();
    montarMeta();
    lead();
    montarAtalhos();
    montarAbaTodos();
    kpiLabels();
    ola();
    atualizarCampanhaSide();
    atualizarOnlineSide();
    atualizarSino();
    sincronizarOutros();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
  window.addEventListener("portal:usuario-validado", function () {
    ola();
    atualizarCampanhaSide();
    atualizarOnlineSide();
    atualizarSino();
    sincronizarOutros();
  });
  window.addEventListener("dk-theme-change", function () {
    if (window.dkSwapBrandLogos) window.dkSwapBrandLogos(!!window.dkIsDark && window.dkIsDark());
  });
  function observar() {
    if (!window.MutationObserver) return;
    var ids = ["avisosContador", "ciopKpiAvisos", "ciopOnlineChip", "heroMesConsciencia", "heroRibbon"];
    var obs = new MutationObserver(function () {
      atualizarCampanhaSide();
      atualizarOnlineSide();
      atualizarSino();
    });
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el, { childList: true, subtree: true, characterData: true });
    });
  }
  observar();
  setTimeout(ola, 600);
  setTimeout(ola, 1600);
  setTimeout(atualizarCampanhaSide, 800);
  setTimeout(sincronizarOutros, 900);
})();
