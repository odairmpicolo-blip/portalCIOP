(function () {
  const FOTOS = "../assets/img/frota/";

  function norm(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function placaLimpa(s) {
    return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  function fotoPorTecnologia(v) {
    const t = norm(v.tecnologia);
    const cor = norm(v.cor);
    const ar = norm(v.climatizacao).includes("com ar");
    const p = String(v.veiculo || "");

    if (t.includes("articulado")) return "superbus-articulado.png";
    if (t.includes("brt")) return "superbus-padron.png";
    if (t.includes("minionibus") || t.includes("low entry") || t.includes("mini especial")) {
      if (cor === "azul" && ar) return "low-entry.png";
      if (cor === "azul") return "micro-azul.png";
      return "micro-amarelo.png";
    }
    if (t.includes("van") || t.includes("leve especial")) return "low-entry.png";
    if (t.includes("leve")) return cor === "azul" ? "leve-azul.png" : "leve-amarelo.png";
    if (t.includes("pesado")) {
      if (cor === "azul" && ar) return p.startsWith("45") ? "pesado-azul-o500.png" : "pesado-azul-ar.png";
      if (cor === "azul") return "pesado-azul.png";
      if (cor === "amarelo" && ar) return "pesado-amarelo-ar.png";
      return "pesado-amarelo.png";
    }
    return "pesado-amarelo.png";
  }

  function modeloPorFoto(arquivo, v) {
    const t = norm(v.tecnologia);
    if (arquivo === "superbus-articulado.png") return "Marcopolo Viale BRT";
    if (arquivo === "superbus-padron.png") return "Marcopolo Superbus";
    if (arquivo === "low-entry.png") return "Agrale Marcopolo Volare";
    if (arquivo.indexOf("micro-") === 0) return "Marcopolo Senior";
    if (arquivo === "pesado-azul-o500.png") return "Mercedes-Benz O 500 / Marcopolo Torino";
    if (t.includes("leve especial")) return "Mercedes-Benz OF 1721";
    if (t.includes("mini")) return "Mercedes-Benz LO 916";
    return "Marcopolo Torino";
  }

  function placaDo(prefixo) {
    const mapa = window.CIOP_VEICULOS_PLACA || {};
    return mapa[String(prefixo)] || "";
  }

  function catalogo() {
    const patio = Array.isArray(window.FROTA_PATIO) ? window.FROTA_PATIO : [];
    return patio.map((v) => {
      const foto = fotoPorTecnologia(v);
      const placa = placaDo(v.veiculo);
      const modelo = modeloPorFoto(foto, v);
      const tecnologia = v.rotulo || [v.cor, v.tecnologia, v.climatizacao].filter(Boolean).join(" · ");
      return {
        prefixo: String(v.veiculo || ""),
        placa,
        placaKey: placaLimpa(placa),
        tecnologia,
        modelo,
        foto: FOTOS + foto,
        busca: norm([v.veiculo, placa, tecnologia, modelo, v.cor, v.tecnologia, v.climatizacao].join(" "))
      };
    });
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  let FROTA = [];

  function buscar(q) {
    const bruto = String(q || "").trim();
    if (!bruto) return FROTA.slice(0, 24);
    const n = norm(bruto);
    const p = placaLimpa(bruto);
    const exatos = [];
    const resto = [];
    for (const v of FROTA) {
      if (v.prefixo === bruto || (p.length >= 4 && v.placaKey === p)) {
        exatos.push(v);
        continue;
      }
      if (v.prefixo.indexOf(bruto) !== -1 || v.busca.indexOf(n) !== -1 || (p && v.placaKey.indexOf(p) !== -1)) {
        resto.push(v);
      }
    }
    return exatos.concat(resto).slice(0, 40);
  }

  function pintarLista(itens, q) {
    const el = document.getElementById("cvLista");
    const vazio = document.getElementById("cvVazio");
    if (!itens.length) {
      el.innerHTML = "";
      vazio.hidden = false;
      vazio.textContent = q ? "Nenhum veículo com esse prefixo, placa, tecnologia ou modelo." : "Nenhum veículo na frota.";
      return;
    }
    vazio.hidden = true;
    el.innerHTML = itens.map((v) =>
      "<button type=\"button\" class=\"cv-row\" data-prefixo=\"" + esc(v.prefixo) + "\">" +
        "<img src=\"" + esc(v.foto) + "\" alt=\"\" width=\"96\" height=\"56\">" +
        "<span class=\"cv-row-main\">" +
          "<strong>" + esc(v.prefixo) + "</strong>" +
          "<em>" + esc(v.placa || "sem placa") + "</em>" +
        "</span>" +
        "<span class=\"cv-row-meta\">" + esc(v.tecnologia) + "<br>" + esc(v.modelo) + "</span>" +
      "</button>"
    ).join("");
  }

  function abrir(v) {
    const dlg = document.getElementById("cvPopup");
    document.getElementById("cvFoto").src = v.foto;
    document.getElementById("cvFoto").alt = "Ônibus " + v.prefixo + " — " + v.tecnologia;
    document.getElementById("cvPrefixo").textContent = v.prefixo;
    document.getElementById("cvPlaca").textContent = v.placa || "—";
    document.getElementById("cvTec").textContent = v.tecnologia || "—";
    document.getElementById("cvModelo").textContent = v.modelo || "—";
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function frotaPorPrefixo(prefixo) {
    return FROTA.find((v) => v.prefixo === String(prefixo));
  }

  function aplicarBusca() {
    const q = document.getElementById("cvBusca").value;
    pintarLista(buscar(q), q);
  }

  function iniciar() {
    FROTA = catalogo();
    document.getElementById("cvContagem").textContent = FROTA.length + " veículos";
    const params = new URLSearchParams(location.search);
    const q0 = params.get("q") || "";
    const busca = document.getElementById("cvBusca");
    busca.value = q0;
    aplicarBusca();
    if (q0) {
      const hit = buscar(q0);
      if (hit.length === 1) abrir(hit[0]);
    }
    busca.addEventListener("input", aplicarBusca);
    busca.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      const hit = buscar(busca.value);
      if (hit[0]) abrir(hit[0]);
    });
    document.getElementById("cvLista").addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-prefixo]");
      if (!btn) return;
      const v = frotaPorPrefixo(btn.getAttribute("data-prefixo"));
      if (v) abrir(v);
    });
    document.getElementById("cvFechar").addEventListener("click", () => {
      document.getElementById("cvPopup").close();
    });
    busca.focus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
