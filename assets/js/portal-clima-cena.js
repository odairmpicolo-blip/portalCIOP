(function (w) {
  function grupoClima(code) {
    var c = Number(code);
    if (c === 0 || c === 1) return "sun";
    if (c === 2) return "partly";
    if (c === 3) return "cloud";
    if (c === 45 || c === 48) return "fog";
    if ([71, 73, 75, 77, 85, 86].indexOf(c) >= 0) return "snow";
    if ([82, 95, 96, 99].indexOf(c) >= 0) return "storm";
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81].indexOf(c) >= 0) return "rain";
    return "cloud";
  }

  function gotas(qtd) {
    var html = "";
    var i;
    for (i = 0; i < qtd; i += 1) {
      var left = ((i * 3.7) + (i % 5) * 1.4) % 100;
      var delay = ((i * 0.09) % 1.6).toFixed(2);
      var dur = (0.85 + (i % 6) * 0.14).toFixed(2);
      var h = 10 + (i % 5) * 3;
      html +=
        '<i class="wx-raindrop" style="left:' +
        left +
        "%;height:" +
        h +
        "%;animation-delay:" +
        delay +
        "s;animation-duration:" +
        dur +
        's"></i>';
    }
    return html;
  }

  function cenaHtml(grupo) {
    if (grupo === "sun") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-sun-rays-bg"></div>' +
        '<div class="wx-sun"></div>' +
        '<div class="wx-cloud-soft c1"></div>' +
        '<div class="wx-cloud-soft c2"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "partly") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-sun-rays-bg is-soft"></div>' +
        '<div class="wx-sun is-soft"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-cloud-mass c3"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "cloud") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-cloud-mass c3"></div>' +
        '<div class="wx-cloud-mass c4"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "rain") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-rain">' +
        gotas(28) +
        "</div>" +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "storm") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-lightning"></div>' +
        '<div class="wx-cloud-mass c1"></div>' +
        '<div class="wx-cloud-mass c2"></div>' +
        '<div class="wx-cloud-mass c4"></div>' +
        '<div class="wx-rain is-heavy">' +
        gotas(36) +
        "</div>" +
        '<div class="wx-haze"></div>'
      );
    }
    if (grupo === "fog") {
      return (
        '<div class="wx-sky"></div>' +
        '<div class="wx-fog-bank b1"></div>' +
        '<div class="wx-fog-bank b2"></div>' +
        '<div class="wx-fog-bank b3"></div>' +
        '<div class="wx-haze"></div>'
      );
    }
    return (
      '<div class="wx-sky"></div>' +
      '<div class="wx-cloud-mass c1"></div>' +
      '<div class="wx-snow"></div>' +
      '<div class="wx-haze"></div>'
    );
  }

  w.portalGrupoClima = grupoClima;
  w.portalMarcarCenaClima = function (code, fxId) {
    var fx = document.getElementById(fxId);
    var grupo = grupoClima(code);
    var scene = fx && (fx.closest(".wx") || fx.closest(".tv-card-weather"));
    if (scene) scene.setAttribute("data-wx", grupo);
    if (!fx) return;
    if (fx.dataset.grupo === grupo) return;
    fx.dataset.grupo = grupo;
    fx.className = "wx-fx is-" + grupo;
    fx.innerHTML = cenaHtml(grupo);
  };
})(window);
