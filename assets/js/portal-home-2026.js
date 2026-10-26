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

  function logoHome() {
    var img = document.querySelector('.home-logo');
    if (img) img.src = 'assets/img/portal-logo-clean-' + (document.documentElement.classList.contains('dk-dark') ? 'dark' : 'light') + '.png';
  }

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

  var HASH_ALVO = {
    inicio: "inicio",
    operacao: "secaoOperacao",
    monitoramento: "secaoDashboards",
    relatorios: "secaoRelatorios",
    tv: "secaoTv",
    outros: "outros"
  };
  var ALVO_HASH = {
    inicio: "inicio",
    secaoOperacao: "operacao",
    secaoDashboards: "monitoramento",
    secaoRelatorios: "relatorios",
    secaoTv: "tv",
    outros: "outros"
  };

  function fecharMenu() {
    document.getElementById("sidebar")?.classList.remove("active");
    document.getElementById("overlay")?.classList.remove("active");
    var menu = document.querySelector(".menu-toggle");
    if (menu) menu.setAttribute("aria-expanded", "false");
  }

  function abrirMenu() {
    document.getElementById("sidebar")?.classList.add("active");
    document.getElementById("overlay")?.classList.add("active");
    var menu = document.querySelector(".menu-toggle");
    if (menu) menu.setAttribute("aria-expanded", "true");
  }

  function marcarNav(alvo) {
    var dockAlvo = alvo === "secaoTv" || alvo === "admin" || alvo === "outros" ? "mais" : alvo;
    document.querySelectorAll(".home-nav-btn, .home-dock-btn").forEach(function (btn) {
      var chave = btn.getAttribute("data-home-nav");
      var active = chave === alvo || (btn.classList.contains("home-dock-btn") && chave === dockAlvo);
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function gravarHash(alvo) {
    var hash = ALVO_HASH[alvo];
    if (!hash) return;
    if ((location.hash || "").replace(/^#/, "") === hash) return;
    history.replaceState(null, "", "#" + hash);
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
      '<img class="home-logo" src="assets/img/portal-logo-clean-light.png" alt="Portal CIOP TCGL Operações">' +
      '<span class="home-brand-copy"><b>Portal CIOP</b><small>TCGL · Operações</small></span>';
    var nav = document.createElement("nav");
    nav.className = "home-nav";
    nav.setAttribute("aria-label", "Áreas do portal");
    nav.innerHTML =
      '<p class="home-nav-label">Áreas</p>' +
      '<button type="button" class="home-nav-btn is-active" data-home-nav="inicio">' + ICO.inicio + " Início</button>" +
      '<button type="button" class="home-nav-btn" data-home-nav="secaoOperacao">' + ICO.operacao + " Operação</button>" +
      '<button type="button" class="home-nav-btn" data-home-nav="secaoDashboards">' + ICO.monitoramento + " Monitoramento</button>" +
      '<button type="button" class="home-nav-btn" data-home-nav="secaoRelatorios">' + ICO.relatorios + " Relatórios</button>" +
      '<button type="button" class="home-nav-btn" data-home-nav="secaoTv">' + ICO.monitor + " TV</button>" +
      '<p class="home-nav-label">Conta</p>' +
      '<a class="home-nav-btn" data-home-nav="admin" data-modulo="gerenciar-usuarios" data-perfis="Administrador,Supervisor,Gerência,Gerencia,Secretária,Secretaria" href="pages/admin-usuarios.html">' +
      ICO.admin + " Administração</a>" +
      '<button type="button" class="home-nav-btn home-outros-btn" data-home-nav="outros" aria-expanded="false" aria-controls="homeOtherPanel">' +
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
        document.body.classList.add("home-show-others");
        montarOutrosCards();
        btn.setAttribute("aria-expanded", "true");
        marcarNav("outros");
        gravarHash("outros");
        fecharMenu();
        return;
      }
      document.body.classList.remove("home-show-others");
      wrap.hidden = true;
      var outrosBtn = nav.querySelector('[data-home-nav="outros"]');
      if (outrosBtn) outrosBtn.setAttribute("aria-expanded", "false");
      if (alvo === "inicio") mostrarTodos();
      else clicarAba(alvo);
      gravarHash(alvo);
      fecharMenu();
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
    if (document.getElementById("homeOtherPanel")) montarOutrosCards();
    if (!visivel) {
      wrap.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  }

  function montarOutrosCards() {
    var container = document.querySelector(".container");
    if (!container) return;
    var panel = document.getElementById("homeOtherPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "homeOtherPanel";
      panel.setAttribute("aria-label", "Outros acessos operacionais");
      panel.innerHTML = '<div class="home-mods-head"><h2>Outros acessos</h2></div><p class="home-other-lead">Ferramentas e sistemas para o seu dia a dia.</p><div class="home-other-grid grid"></div>';
      container.insertBefore(panel, container.firstChild);
    }
    var grid = panel.querySelector(".home-other-grid");
    grid.replaceChildren();
    document.querySelectorAll("#homeOutros .side-link").forEach(function (source) {
      if (source.hidden || source.style.display === "none" || (source.matches("[data-perfis], [data-usuarios], [data-modulo]") && !source.classList.contains("portal-card-visivel"))) return;
      var card = source.cloneNode(true);
      card.removeAttribute("id");
      card.className = "home-other-card portal-card-visivel";
      card.querySelectorAll("[id]").forEach(function (el) { el.removeAttribute("id"); });
      if (source.tagName === "BUTTON") card.addEventListener("click", function () { source.click(); });
      grid.appendChild(card);
    });
    filtrarOutros();
  }

  function filtrarOutros() {
    var search = document.getElementById("ciopBuscaModulos");
    var value = (search?.value || "").toLocaleLowerCase("pt-BR");
    document.querySelectorAll(".home-other-card").forEach(function (card) {
      var hit = card.textContent.toLocaleLowerCase("pt-BR").includes(value);
      card.hidden = !hit;
      card.classList.toggle("ciop-search-hit", !!(value && hit));
    });
  }

  function montarFecharMenu() {
    var side = document.getElementById("sidebar");
    if (!side || side.querySelector(".home-side-close")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "home-side-close";
    btn.setAttribute("aria-label", "Fechar menu");
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    btn.addEventListener("click", fecharMenu);
    side.insertBefore(btn, side.firstChild);
  }

  function montarDock() {
    if (document.querySelector(".home-dock")) return;
    var dock = document.createElement("nav");
    dock.className = "home-dock";
    dock.setAttribute("aria-label", "Navegação principal");
    dock.innerHTML =
      '<button type="button" class="home-dock-btn is-active" data-home-nav="inicio">' + ICO.inicio + "<span>Início</span></button>" +
      '<button type="button" class="home-dock-btn" data-home-nav="secaoOperacao">' + ICO.operacao + "<span>Operação</span></button>" +
      '<button type="button" class="home-dock-btn" data-home-nav="secaoDashboards">' + ICO.monitoramento + "<span>Monitor</span></button>" +
      '<button type="button" class="home-dock-btn" data-home-nav="secaoRelatorios">' + ICO.relatorios + "<span>Relatórios</span></button>" +
      '<button type="button" class="home-dock-btn" data-home-nav="mais" aria-controls="sidebar" aria-expanded="false">' + ICO.outros + "<span>Mais</span></button>";
    dock.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-home-nav]");
      if (!btn) return;
      var alvo = btn.getAttribute("data-home-nav");
      if (alvo === "mais") {
        var aberto = document.getElementById("sidebar")?.classList.contains("active");
        if (aberto) fecharMenu();
        else abrirMenu();
        btn.setAttribute("aria-expanded", String(!aberto));
        return;
      }
      document.body.classList.remove("home-show-others");
      if (alvo === "inicio") mostrarTodos();
      else clicarAba(alvo);
      gravarHash(alvo);
      fecharMenu();
    });
    document.body.appendChild(dock);
  }

  function aplicarHash() {
    var chave = (location.hash || "").replace(/^#/, "").toLowerCase();
    var alvo = HASH_ALVO[chave];
    if (!alvo) return;
    if (alvo === "outros") {
      document.body.classList.add("home-show-others");
      montarOutrosCards();
      var outrosBtn = document.querySelector('[data-home-nav="outros"]');
      if (outrosBtn) outrosBtn.setAttribute("aria-expanded", "true");
      marcarNav("outros");
      return;
    }
    document.body.classList.remove("home-show-others");
    if (alvo === "inicio") mostrarTodos();
    else clicarAba(alvo);
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
    bell.setAttribute("aria-label", "Ver meus avisos");
    bell.setAttribute("aria-haspopup", "dialog");
    bell.innerHTML = ICO.sino + '<span class="home-bell-count" id="homeBellCount" data-empty="1"></span>';
    bell.addEventListener("click", function () {
      if (window.portalHomeSettings?.openNotices) window.portalHomeSettings.openNotices();
      else document.querySelector(".notice-board")?.scrollIntoView({ block: "start" });
    });
    if (lock) {
      var menu = lock.querySelector(".menu-toggle");
      if (menu) {
        menu.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
        menu.setAttribute("aria-controls", "sidebar");
        menu.setAttribute("aria-expanded", "false");
        new MutationObserver(function () {
          var aberto = document.getElementById("sidebar").classList.contains("active");
          menu.setAttribute("aria-expanded", String(aberto));
          var mais = document.querySelector('.home-dock-btn[data-home-nav="mais"]');
          if (mais) mais.setAttribute("aria-expanded", String(aberto));
        }).observe(document.getElementById("sidebar"), { attributes: true, attributeFilter: ["class"] });
      }
      bar.appendChild(lock);
    }
    bar.appendChild(search);
    bar.appendChild(bell);
    if (actions) bar.appendChild(actions);
    header.insertBefore(bar, header.firstChild);
  }

  function montarIndicadoresNoHeader() {
    var hero = document.getElementById("headerHero");
    if (!hero || hero.querySelector(".home-header-stats")) return;
    var stats = document.createElement("div");
    stats.className = "home-header-stats ciop-zone-status";
    stats.setAttribute("aria-label", "Resumo da operação");
    ["ciopKpiModulos", "ciopKpiUsuarios", "ciopKpiAvisos"].forEach(function (id) {
      var card = document.getElementById(id)?.closest(".ciop-kpi");
      if (card) stats.appendChild(card);
    });
    hero.insertBefore(stats, hero.querySelector(".home-meta"));
  }

  var PERF_API = "https://londrisul.online/relatorios/mapa/api.php?chave=" + encodeURIComponent("Pontualidade@2026");
  var perfTimer = 0;
  function fmtPct(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
  }
  function animarPct(id, v, delayMs) {
    var el = document.getElementById(id);
    if (!el) return;
    var n = Number(v);
    if (!Number.isFinite(n)) {
      el.textContent = "—";
      return;
    }
    var casas = Math.round(n * 100) % 100 === 0 ? 0 : 2;
    function run() {
      if (typeof window.portalContarNumero === "function") {
        window.portalContarNumero(el, n, { suffix: "%", decimals: casas, duration: 0.9 });
      } else {
        el.textContent = fmtPct(n);
      }
    }
    if (delayMs) setTimeout(run, delayMs);
    else run();
  }
  function isTcgl(g) {
    var n = String(g && g.nome || "").toUpperCase();
    return n.includes("TCGL") || Number(g && g.id) === 9;
  }
  function carregarPerfTcgl() {
    fetch(PERF_API + "&t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (payload) {
      var garagens = Array.isArray(payload && payload.garagens) ? payload.garagens : [];
      var tcgl = garagens.find(isTcgl) || {};
      animarPct("homePerfOk", tcgl.onTimePercent, 0);
      animarPct("homePerfEarly", tcgl.earlyPercent, 90);
      animarPct("homePerfLate", tcgl.latePercent, 180);
      var block = document.getElementById("homePerfKpis");
      if (block) {
        block.setAttribute("aria-label", "Performance TCGL: " + fmtPct(tcgl.onTimePercent) + " no horário, " + fmtPct(tcgl.earlyPercent) + " adiantado, " + fmtPct(tcgl.latePercent) + " atrasado");
        var bar = block.querySelector(".home-perf-bar");
        if (!bar) {
          bar = document.createElement("span");
          bar.className = "home-perf-bar";
          bar.setAttribute("aria-hidden", "true");
          bar.innerHTML = '<i class="is-ok"></i><i class="is-early"></i><i class="is-late"></i>';
          block.appendChild(bar);
        }
        var ok = Math.max(0, Number(tcgl.onTimePercent) || 0);
        var early = Math.max(0, Number(tcgl.earlyPercent) || 0);
        var late = Math.max(0, Number(tcgl.latePercent) || 0);
        var segs = bar.querySelectorAll("i");
        if (segs[0]) segs[0].style.flexGrow = String(ok);
        if (segs[1]) segs[1].style.flexGrow = String(early);
        if (segs[2]) segs[2].style.flexGrow = String(late);
      }
    }).catch(function () {});
  }
  function montarPerformanceNoHeader() {
    var hero = document.getElementById("headerHero");
    var block = document.getElementById("homePerfKpis");
    if (!hero || !block) return;
    var meta = hero.querySelector(".home-meta");
    if (block.parentNode !== hero) {
      if (meta) hero.insertBefore(block, meta);
      else hero.appendChild(block);
    }
    carregarPerfTcgl();
    if (!perfTimer) perfTimer = setInterval(carregarPerfTcgl, 15000);
  }

  function montarCommandStrip() {
    var hero = document.getElementById("headerHero");
    if (!hero || hero.querySelector(".home-command")) return;
    var stats = hero.querySelector(".home-header-stats");
    var perf = hero.querySelector(".home-perf");
    if (!stats && !perf) return;
    var wrap = document.createElement("div");
    wrap.className = "home-command";
    wrap.setAttribute("aria-label", "Central de comando");
    if (perf) wrap.appendChild(perf);
    if (stats) wrap.appendChild(stats);
    var meta = hero.querySelector(".home-meta");
    if (meta && meta.nextSibling) hero.insertBefore(wrap, meta.nextSibling);
    else hero.appendChild(wrap);
  }

  function montarMeta() {
    var hero = document.getElementById("headerHero");
    if (!hero || hero.querySelector(".home-meta")) return;
    var meta = document.createElement("div");
    meta.className = "home-meta home-now";
    var time = document.createElement("div");
    time.className = "home-now-time";
    var hora = document.querySelector(".ciop-kpi-hora");
    var data = document.querySelector(".ciop-kpi-data");
    var clima = document.querySelector(".ciop-kpi-clima");
    if (hora) time.appendChild(hora);
    if (data) time.appendChild(data);
    meta.appendChild(time);
    if (clima) {
      clima.classList.add("home-now-wx");
      meta.appendChild(clima);
    }
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
    if ((!nome.trim() && !texto.trim()) || /carregando/i.test(texto)) { dest.hidden = true; return; }
    dest.hidden = false;
    dest.innerHTML =
      (ribbon && ribbon.innerHTML ? '<span class="home-campaign-ribbon">' + ribbon.innerHTML + '</span>' : '<span class="home-campaign-ribbon" aria-hidden="true"><svg viewBox="0 0 32 48"><path d="M8 7C11-1 23-1 26 7c3 9-5 21-17 39L2 37C13 23 21 12 19 7c-1-2-4-2-5 0-3 6 6 20 16 30l-7 9C10 30 3 17 8 7Z" fill="currentColor"/></svg></span>') +
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
    wrap.className = "home-modules-overview";
    wrap.innerHTML =
      '<div class="home-quick-head"><h2>Acessos rápidos</h2></div>' +
      '<section class="home-quick" id="homeQuick">' +
      '<a href="pages/monitoramento.html">' + ICO.monitor + "<strong>Monitoramento</strong><span>Operação ao vivo</span></a>" +
      '<a href="pages/Folhadeservico1.html">' + ICO.servico + "<strong>Lançar serviço</strong><span>Novo lançamento</span></a>" +
      '<a href="pages/liberacao-lancamento.html">' + ICO.liberacao + "<strong>Liberação</strong><span>Fila de liberações</span></a>" +
      '<a href="pages/criar-relatorio.html">' + ICO.relatorio + "<strong>Criar relatório</strong><span>Novo relatório</span></a>" +
      "</section>" +
      '<div class="home-mods-head"><h2>Módulos da operação</h2></div>';
    abas.parentNode.insertBefore(wrap, abas);
    wrap.querySelector(".home-mods-head").appendChild(abas);
  }

  // Atalhos reflect the original module visibility; they must never expose a restricted entry.
  function sincronizarAtalhos() {
    if (window.portalHomeSettings) { window.portalHomeSettings.refresh(); return; }
    document.querySelectorAll("#homeQuick a").forEach(function (link) {
      var source = Array.prototype.find.call(document.querySelectorAll(".card-section a.card"), function (card) {
        return card.getAttribute("href") === link.getAttribute("href");
      });
      link.hidden = !source || source.hidden || source.style.display === "none" || (source.matches("[data-perfis], [data-usuarios], [data-modulo]") && !source.classList.contains("portal-card-visivel"));
    });
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
    setTimeout(function () {
      if (HASH_ALVO[(location.hash || "").replace(/^#/, "").toLowerCase()]) aplicarHash();
      else mostrarTodos();
    }, 0);
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
      ciopKpiModulos: { t: "Módulos", i: ICO.monitoramento },
      ciopKpiUsuarios: { t: "Usuários ativos", i: ICO.admin },
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
    var existing = document.querySelector(".home-sheet");
    if (existing) {
      if (!existing.id) existing.id = "homeConteudo";
      return;
    }
    var header = document.querySelector("header.header");
    var toolbar = document.querySelector(".toolbar");
    var container = document.querySelector(".container");
    if (!header || !container || !header.parentNode) return;
    var sheet = document.createElement("div");
    sheet.className = "home-sheet";
    sheet.id = "homeConteudo";
    sheet.setAttribute("tabindex", "-1");
    header.parentNode.insertBefore(sheet, header);
    sheet.appendChild(header);
    if (toolbar) sheet.appendChild(toolbar);
    sheet.appendChild(container);
  }

  function pularParaConteudo() {
    if (document.querySelector(".home-skip")) return;
    var skip = document.createElement("a");
    skip.className = "home-skip";
    skip.href = "#homeConteudo";
    skip.textContent = "Ir para o conteúdo";
    document.body.insertBefore(skip, document.body.firstChild);
  }

  function iniciar() {
    montarNav();
    montarFecharMenu();
    montarDock();
    logoHome();
    montarSheet();
    pularParaConteudo();
    montarTopo();
    montarMeta();
    montarIndicadoresNoHeader();
    montarPerformanceNoHeader();
    montarCommandStrip();
    lead();
    montarAtalhos();
    window.portalHomeSettings?.init();
    sincronizarAtalhos();
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
    sincronizarAtalhos();
    ola();
    atualizarCampanhaSide();
    atualizarOnlineSide();
    atualizarSino();
    sincronizarOutros();
  });
  window.addEventListener("dk-theme-change", function () {
    logoHome();
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
  var cardsObserver = new MutationObserver(sincronizarAtalhos);
  document.querySelectorAll(".card-section a.card").forEach(function (card) {
    cardsObserver.observe(card, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
  });
  document.querySelectorAll("#homeOutros .side-link").forEach(function (link) {
    cardsObserver.observe(link, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
  });
  var linksObserver = new MutationObserver(sincronizarOutros);
  document.querySelectorAll("#homeOutros .side-link").forEach(function (link) {
    linksObserver.observe(link, { attributes: true, attributeFilter: ["hidden", "style", "class"] });
  });
  function compactarAvisos() {
    var board = document.querySelector(".notice-board");
    if (!board || board.querySelector(".notice-open")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "notice-open";
    btn.textContent = "Ver aviso";
    btn.addEventListener("click", function () {
      if (window.portalHomeSettings && window.portalHomeSettings.openNotices) window.portalHomeSettings.openNotices();
    });
    board.appendChild(btn);
  }
  compactarAvisos();
  document.getElementById("ciopBuscaModulos")?.addEventListener("input", filtrarOutros);
  document.getElementById("ciopBuscaLimpar")?.addEventListener("click", function () { setTimeout(filtrarOutros, 0); });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    fecharMenu();
  });
  window.addEventListener("hashchange", aplicarHash);
  setTimeout(ola, 600);
  setTimeout(ola, 1600);
  setTimeout(atualizarCampanhaSide, 800);
  setTimeout(sincronizarOutros, 900);
})();
