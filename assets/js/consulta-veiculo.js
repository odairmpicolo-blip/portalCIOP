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

  function formatarTamanho(num) {
    const n = String(num || "").replace(".", ",");
    return n + " metros";
  }

  function separarModelo(bruto) {
    const raw = String(bruto || "")
      .replace(/\s+/g, " ")
      .replace(/\s*-\s*/g, " - ")
      .trim();
    if (!raw) return { modelo: "", tamanho: "" };
    const partes = raw.split(" - ").map((p) => p.trim()).filter(Boolean);
    const reTam = /^(\d+(?:[.,]\d+)?)\s*M$/i;
    let tamNum = "";
    const resto = [];
    for (const p of partes) {
      const m = p.match(reTam);
      if (m && !tamNum) tamNum = m[1];
      else resto.push(p);
    }
    return {
      modelo: resto.join(" - ") || raw,
      tamanho: tamNum ? formatarTamanho(tamNum) : ""
    };
  }

  function temArCondicionado(t) {
    return t.includes("ar condicionado");
  }

  function fotoPorTecnologia(tecnologia, modelo) {
    const t = norm(tecnologia);
    const m = norm(modelo);
    if (!t || t === "especial") return "";
    if (t.includes("articulado")) return "superbus-articulado.png";
    if (t.includes("padron")) return "superbus-padron.png";
    if (t.includes("low entry")) return "low-entry.png";
    if (t.includes("microonibus azul")) return "micro-azul.png";
    if (t.includes("microonibus amarelo")) return "micro-amarelo.png";
    if (t.includes("leve azul")) return "leve-azul.png";
    if (t.includes("leve amarelo")) return "leve-amarelo.png";
    if (t.includes("pesado azul") && temArCondicionado(t)) {
      return m.includes("o500") ? "pesado-azul-o500.png" : "pesado-azul-ar.png";
    }
    if (t.includes("pesado azul")) return "pesado-azul.png";
    if (t.includes("pesado amarelo") && temArCondicionado(t)) return "pesado-amarelo-ar.png";
    if (t.includes("pesado amarelo")) return "pesado-amarelo.png";
    return "";
  }

  function catalogo() {
    const lista = Array.isArray(window.CIOP_FROTA_CONSULTA) ? window.CIOP_FROTA_CONSULTA : [];
    return lista.map((v) => {
      const prefixo = String(v.prefixo || "").trim();
      const placa = String(v.placa || "").trim();
      const tecnologia = String(v.tecnologia || "").trim();
      const modeloBruto = String(v.modelo || "").trim();
      const partes = separarModelo(modeloBruto);
      const fotoArq = fotoPorTecnologia(tecnologia, modeloBruto);
      return {
        prefixo,
        placa,
        placaKey: placaLimpa(placa),
        tecnologia,
        modelo: partes.modelo,
        tamanho: partes.tamanho,
        foto: fotoArq ? new URL(FOTOS + fotoArq, document.baseURI).href : "",
        busca: norm([prefixo, placa, tecnologia, modeloBruto, partes.modelo, partes.tamanho].join(" "))
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

  function limparLista() {
    const lista = document.getElementById("cvLista");
    const qtd = document.getElementById("cvQtd");
    lista.innerHTML = "";
    lista.hidden = true;
    qtd.hidden = true;
    qtd.textContent = "";
  }

  function pintarLista(hit) {
    const lista = document.getElementById("cvLista");
    const qtd = document.getElementById("cvQtd");
    lista.innerHTML = "";
    const n = hit.length;
    if (!n) {
      qtd.hidden = true;
      qtd.textContent = "";
      lista.hidden = true;
      return;
    }
    qtd.hidden = false;
    qtd.textContent = n === 1 ? "1 veículo" : n + " veículos";
    const frag = document.createDocumentFragment();
    hit.forEach((v) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cv-item";
      btn.setAttribute("aria-label", "Abrir " + v.prefixo);
      const strong = document.createElement("strong");
      strong.textContent = v.prefixo;
      const placa = document.createElement("span");
      placa.textContent = v.placa || "—";
      const tec = document.createElement("em");
      tec.textContent = v.tecnologia || v.modelo || "—";
      btn.append(strong, placa, tec);
      btn.addEventListener("click", () => abrir(v));
      li.appendChild(btn);
      frag.appendChild(li);
    });
    lista.appendChild(frag);
    lista.hidden = false;
  }

  function abrir(v) {
    const dlg = document.getElementById("cvPopup");
    const foto = document.getElementById("cvFoto");
    const sem = document.getElementById("cvSemFoto");
    foto.onerror = null;
    if (v.foto) {
      sem.hidden = true;
      foto.hidden = false;
      foto.alt = "Ônibus " + v.prefixo + " — " + v.tecnologia;
      foto.onerror = () => {
        foto.onerror = null;
        foto.removeAttribute("src");
        foto.hidden = true;
        sem.hidden = false;
      };
      foto.src = v.foto;
    } else {
      foto.removeAttribute("src");
      foto.hidden = true;
      sem.hidden = false;
    }
    document.getElementById("cvPrefixo").textContent = v.prefixo;
    document.getElementById("cvPlaca").textContent = v.placa || "—";
    document.getElementById("cvTec").textContent = v.tecnologia || "—";
    document.getElementById("cvModelo").textContent = v.modelo || "—";
    const tamDt = document.getElementById("cvTamDt");
    const tamDd = document.getElementById("cvTamanho");
    if (v.tamanho) {
      tamDt.hidden = false;
      tamDd.hidden = false;
      tamDd.textContent = v.tamanho;
    } else {
      tamDt.hidden = true;
      tamDd.hidden = true;
      tamDd.textContent = "—";
    }
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "");
  }

  function atualizarResultados(abrirUnico) {
    const q = document.getElementById("cvBusca").value;
    const bruto = String(q || "").trim();
    if (!bruto) {
      setStatus("Digite o prefixo, a placa, a tecnologia ou o modelo.", "info");
      limparLista();
      return;
    }
    const hit = buscar(q);
    if (!hit.length) {
      setStatus("Nenhum veículo com esse prefixo, placa, tecnologia ou modelo.", "erro");
      pintarLista([]);
      return;
    }
    setStatus("");
    pintarLista(hit);
    if (!abrirUnico) return;
    const p = placaLimpa(bruto);
    const unico = hit.find((v) => v.prefixo === bruto) || (p.length >= 5 && hit.find((v) => v.placaKey === p));
    if (unico) abrir(unico);
    else if (hit.length === 1) abrir(hit[0]);
  }

  function consultar() {
    atualizarResultados(true);
  }

  function iniciar() {
    FROTA = catalogo();
    const busca = document.getElementById("cvBusca");
    const params = new URLSearchParams(location.search);
    const q0 = params.get("q") || "";
    busca.value = q0;
    document.getElementById("cvConsultar").addEventListener("click", consultar);
    busca.addEventListener("input", () => atualizarResultados(false));
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
