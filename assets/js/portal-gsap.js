/* Entrada do portal com GSAP. Respeita prefers-reduced-motion. */
(function () {
  if (!window.gsap) return;

  var motionOk = false;
  gsap.matchMedia().add(
    {
      reduce: "(prefers-reduced-motion: reduce)",
      motion: "(prefers-reduced-motion: no-preference)"
    },
    function (ctx) {
      motionOk = !ctx.conditions.reduce;
      return function () {
        motionOk = false;
      };
    }
  );

  function limpar(alvos) {
    var lista = [];
    alvos.forEach(function (el) {
      if (!el) return;
      if (typeof el.length === "number" && !el.nodeType) {
        Array.prototype.forEach.call(el, function (n) {
          if (n) lista.push(n);
        });
        return;
      }
      lista.push(el);
    });
    if (lista.length) gsap.set(lista, { clearProps: "transform,opacity,visibility" });
  }

  var chromeFeito = false;
  function animarChrome() {
    if (chromeFeito) return;
    var header = document.querySelector(".header.header-v2");
    var hero = document.querySelector(".hero-pro-copy");
    var kpis = document.querySelectorAll(".ciop-command-inner .ciop-kpi");
    var busca = document.querySelector(".ciop-search");
    var avisos = document.querySelector(".notice-board");
    var abas = document.querySelector(".portal-abas");
    if (!header && !kpis.length && !abas) return;
    chromeFeito = true;

    var tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: function () {
        limpar([header, hero, kpis, busca, avisos, abas]);
      }
    });
    if (header) tl.from(header, { y: -16, autoAlpha: 0, duration: 0.5 }, 0);
    if (hero) tl.from(hero, { x: -14, autoAlpha: 0, duration: 0.45 }, 0.06);
    if (kpis.length) {
      tl.from(kpis, { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.04 }, 0.1);
    }
    if (busca) tl.from(busca, { y: 10, autoAlpha: 0, duration: 0.4 }, 0.16);
    if (avisos) tl.from(avisos, { y: 14, autoAlpha: 0, duration: 0.45 }, 0.14);
    if (abas) tl.from(abas, { y: 10, autoAlpha: 0, duration: 0.4 }, 0.2);
  }

  function animarCards(sec) {
    if (!sec) return;
    var cards = sec.querySelectorAll("a.card:not([hidden])");
    if (!cards.length) return;
    gsap.killTweensOf(cards);
    gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 18, scale: 0.975 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.48,
        ease: "power3.out",
        stagger: 0.04,
        overwrite: "auto",
        clearProps: "transform,opacity,visibility"
      }
    );
  }

  function bindHover() {
    if (bindHover.ok) return;
    bindHover.ok = true;
    document.body.classList.add("portal-gsap");

    document.addEventListener("pointerover", function (ev) {
      if (!motionOk) return;
      var card = ev.target.closest && ev.target.closest(".grid a.card");
      if (!card || card.hidden) return;
      if (ev.relatedTarget && card.contains(ev.relatedTarget)) return;
      gsap.to(card, { y: -6, duration: 0.28, ease: "power2.out", overwrite: "auto" });
    });

    document.addEventListener("pointerout", function (ev) {
      if (!motionOk) return;
      var card = ev.target.closest && ev.target.closest(".grid a.card");
      if (!card) return;
      if (ev.relatedTarget && card.contains(ev.relatedTarget)) return;
      gsap.to(card, {
        y: 0,
        duration: 0.32,
        ease: "power2.out",
        overwrite: "auto",
        clearProps: "y"
      });
    });
  }

  window.portalAnimarSecao = function (sec) {
    if (!motionOk || !window.portalUsuarioValidado) return;
    animarChrome();
    animarCards(sec);
    bindHover();
  };

  var loginFeito = false;
  function animarLogin() {
    if (loginFeito || !motionOk) return;
    if (!document.body || !document.body.classList.contains("login-v2")) return;
    loginFeito = true;
    var marca = document.querySelector(".login-brand-v2");
    var card = document.querySelector(".login-card-v2");
    var campos = document.querySelectorAll(
      ".login-card-v2 label, .login-card-v2 input, .login-card-v2 .btn-primary, .login-card-v2 .btn-link"
    );
    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (marca) tl.from(marca, { y: -18, autoAlpha: 0, duration: 0.55 }, 0);
    if (card) tl.from(card, { y: 22, autoAlpha: 0, duration: 0.6 }, 0.08);
    if (campos.length) {
      tl.from(
        campos,
        {
          y: 10,
          autoAlpha: 0,
          duration: 0.38,
          stagger: 0.05,
          clearProps: "transform,opacity,visibility"
        },
        0.22
      );
    }
    tl.eventCallback("onComplete", function () {
      limpar([marca, card]);
    });
  }

  if (document.body && document.body.classList.contains("login-v2")) {
    var ocultar = window.portalOcultarCarregando;
    window.portalOcultarCarregando = function () {
      if (typeof ocultar === "function") ocultar();
      animarLogin();
    };
  }
})();
