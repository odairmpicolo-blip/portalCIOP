(function () {
  const FOTOS = "../assets/img/frota/";
  const MODELO_ESPECIAL = "Mercedes Benz 13,20m OF 1726L";
  const PLACA_EXTRA = {
    "1042": "ATR 8J28",
    "1044": "ETQ 2G42",
    "1052": "ARY 1611"
  };

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

  function ehEspecial(v) {
    return norm(v.tecnologia).includes("especial");
  }

  function fotoPorTecnologia(v) {
    if (ehEspecial(v)) return "";
    const t = norm(v.tecnologia);
    const cor = norm(v.cor);
    const ar = norm(v.climatizacao).includes("com ar");
    const p = String(v.veiculo || "");

    if (t.includes("articulado")) return "superbus-articulado.png";
    if (t.includes("brt")) return "superbus-padron.png";
    if (t.includes("minionibus") || t.includes("low entry")) {
      if (cor === "azul" && ar) return "low-entry.png";
      if (cor === "azul") return "micro-azul.png";
      return "micro-amarelo.png";
    }
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
    if (ehEspecial(v)) return MODELO_ESPECIAL;
    if (arquivo === "superbus-articulado.png") return "Marcopolo Viale BRT";
    if (arquivo === "superbus-padron.png") return "Marcopolo Superbus";
    if (arquivo === "low-entry.png") return "Agrale Marcopolo Volare";
    if (arquivo.indexOf("micro-") === 0) return "Marcopolo Senior";
    if (arquivo === "pesado-azul-o500.png") return "Mercedes-Benz O 500 / Marcopolo Torino";
    return "Marcopolo Torino";
  }

  function placaDo(prefixo) {
    const extra = PLACA_EXTRA[String(prefixo)];
    if (extra) return extra;
    const mapa = window.CIOP_VEICULOS_PLACA || {};
    return mapa[String(prefixo)] || "";
  }

  function catalogo() {
    const patio = Array.isArray(window.FROTA_PATIO) ? window.FROTA_PATIO : [];
    return patio.map((v) => {
      const fotoArq = fotoPorTecnologia(v);
      const placa = placaDo(v.veiculo);
      const modelo = modeloPorFoto(fotoArq, v);
      const tecnologia = v.rotulo || [v.cor, v.tecnologia, v.climatizacao].filter(Boolean).join(" · ");
      return {
        prefixo: String(v.veiculo || ""),
        placa,
        placaKey: placaLimpa(placa),
        tecnologia,
        modelo,
        foto: fotoArq ? FOTOS + fotoArq : "",
        busca: norm([v.veiculo, placa, tecnologia, modelo, v.cor, v.tecnologia, v.climatizacao].join(" "))
      };
    });
  }

  let FROTA = [];

  function buscar(q) {
    const bruto = String(q || "").trim();
    if (!bruto) return [];
    const n = norm(bruto);
    const p = placaLimpa(bruto);
    const exatos = [];
    const resto = [];
    for (const v of FROTA) {
      if (v.prefixo === bruto || (p.length >= 5 && v.placaKey === p)) {
        exatos.push(v);
        continue;
      }
      if (v.prefixo.indexOf(bruto) !== -1 || v.busca.indexOf(n) !== -1 || (p.length >= 4 && v.placaKey.indexOf(p) !== -1)) {
        resto.push(v);
      }
    }
    return exatos.concat(resto);
  }

  function setStatus(msg, tipo) {
    const el = document.getElementById("cvStatus");
    el.textContent = msg || "";
    el.dataset.tipo = tipo || "";
  }

  function abrir(v) {
    const dlg = document.getElementById("cvPopup");
    const foto = document.getElementById("cvFoto");
    const sem = document.getElementById("cvSemFoto");
    if (v.foto) {
      foto.hidden = false;
      sem.hidden = true;
      foto.src = v.foto;
      foto.alt = "Ônibus " + v.prefixo + " — " + v.tecnologia;
    } else {
      foto.removeAttribute("src");
      foto.hidden = true;
      sem.hidden = false;
    }
    document.getElementById("cvPrefixo").textContent = v.prefixo;
    document.getElementById("cvPlaca").textContent = v.placa || "—";
    document.getElementById("cvTec").textContent = v.tecnologia || "—";
    document.getElementById("cvModelo").textContent = v.modelo || "—";
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function consultar() {
    const q = document.getElementById("cvBusca").value;
    const hit = buscar(q);
    if (!String(q || "").trim()) {
      setStatus("Digite o prefixo, a placa, a tecnologia ou o modelo.", "info");
      return;
    }
    if (!hit.length) {
      setStatus("Nenhum veículo com esse prefixo, placa, tecnologia ou modelo.", "erro");
      return;
    }
    const bruto = String(q).trim();
    const p = placaLimpa(bruto);
    const unico = hit.find((v) => v.prefixo === bruto) || (p.length >= 5 && hit.find((v) => v.placaKey === p));
    if (unico) {
      setStatus("");
      abrir(unico);
      return;
    }
    if (hit.length === 1) {
      setStatus("");
      abrir(hit[0]);
      return;
    }
    setStatus(hit.length + " veículos. Informe o prefixo ou a placa completa.", "info");
  }

  function iniciar() {
    FROTA = catalogo();
    const busca = document.getElementById("cvBusca");
    const params = new URLSearchParams(location.search);
    const q0 = params.get("q") || "";
    busca.value = q0;
    document.getElementById("cvConsultar").addEventListener("click", consultar);
    busca.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        consultar();
      }
    });
    document.getElementById("cvFechar").addEventListener("click", () => {
      document.getElementById("cvPopup").close();
    });
    if (q0) consultar();
    busca.focus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
