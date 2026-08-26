(function () {
  var CAD_URL = "https://cioplondrina.com.br/CADIncidentManagement/";
  var OCULTAS = { payload: 1, html: 1, xml: 1, foto: 1, image: 1, blob: 1 };
  var CAMPOS = [
    ["id", "ID"],
    ["registro", "Registro"],
    ["data", "Data"],
    ["hora", "Hora"],
    ["empresa", "Empresa"],
    ["departamento", "Departamento"],
    ["veiculo", "Veículo"],
    ["prefixo", "Prefixo"],
    ["veiculoDescricao", "Descrição do veículo"],
    ["veiculoSubstituto", "Veículo substituto"],
    ["veiculoSubstitutoDescricao", "Descrição do substituto"],
    ["veiculo_substituto", "Veículo substituto"],
    ["linha", "Linha"],
    ["criadoPor", "Analista"],
    ["aberto_por", "Aberto por"],
    ["motoristaNr", "Nr. Motorista"],
    ["motorista", "Motorista"],
    ["operador", "Operador"],
    ["tipo", "Tipo do incidente"],
    ["tipoOriginal", "Tipo original"],
    ["tipo_de_incidente", "Tipo do incidente"],
    ["proprietario", "Agente"],
    ["aberto_para", "Aberto para"],
    ["estado", "Estado"],
    ["natureOfProblem", "Natureza do problema"],
    ["natureza_do_ploblema", "Natureza do problema"],
    ["instructions", "Instruções"],
    ["instrucao", "Instrução"],
    ["cmtuStatus", "Status"],
    ["cmtuPor", "Por"],
    ["cmtuJustificativa", "Justificativa"],
    ["registroVazio", "Registro vazio"]
  ];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pick(row, keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = row && row[keys[i]];
      if (v != null && String(v).trim() !== "") return v;
    }
    return "";
  }

  function rotulo(chave) {
    var conhecido = CAMPOS.find(function (par) { return par[0] === chave; });
    if (conhecido) return conhecido[1];
    return String(chave)
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/_/g, " ")
      .replace(/^\w/, function (c) { return c.toUpperCase(); });
  }

  function texto(valor) {
    if (valor == null || valor === "") return "—";
    if (typeof valor === "boolean") return valor ? "Sim" : "Não";
    if (typeof valor === "object") {
      try { return JSON.stringify(valor, null, 2); } catch (e) { return String(valor); }
    }
    return String(valor);
  }

  function tipoIncidente(row) {
    var tipo = String(pick(row, ["tipoOriginal", "tipo", "tipo_de_incidente"]) || "").trim();
    if (!tipo || tipo.toUpperCase() === "VAZIO") tipo = String(row && row.tipo || "").trim();
    if (tipo.toUpperCase() === "AE") return "AE (Botão de Emergência)";
    return tipo || "Sem informação";
  }

  function temJustificativaCmtu(row) {
    if (!row) return false;
    return !!(row.cmtuReprovado || row.cmtuAprovado || String(row.cmtuJustificativa || "").trim()
      || String(row.cmtuReprovadoPor || "").trim() || String(row.cmtuAprovadoPor || "").trim());
  }

  function statusJustificativaCmtu(row) {
    if (row && (row.cmtuReprovado === true || String(row.cmtuReprovado || "").toLowerCase() === "true")) return "Reprovado";
    if (row && (row.cmtuAprovado === true || String(row.cmtuAprovado || "").toLowerCase() === "true")) return "Aprovado";
    if (String(row && row.cmtuReprovadoPor || "").trim()) return "Reprovado";
    if (String(row && row.cmtuAprovadoPor || "").trim()) return "Aprovado";
    return "";
  }

  function porJustificativaCmtu(row) {
    return String((row && (row.cmtuReprovadoPor || row.cmtuAprovadoPor)) || "").trim();
  }

  function campos(row) {
    if (!row || typeof row !== "object") return [];
    var vistos = {};
    var lista = [];
    CAMPOS.forEach(function (par) {
      var chave = par[0];
      var temTipo = "tipo" in row || "tipoOriginal" in row || "tipo_de_incidente" in row;
      if (chave === "cmtuStatus" || chave === "cmtuPor" || chave === "cmtuJustificativa") {
        if (!temJustificativaCmtu(row)) return;
      } else if (!(chave in row) && chave !== "id" && !(chave === "tipo" && temTipo)) return;
      vistos[chave] = 1;
      var valor = row[chave];
      if (chave === "id") valor = pick(row, ["id", "incidentId", "registro"]);
      if (chave === "tipo" || chave === "tipo_de_incidente") valor = tipoIncidente(row);
      if (chave === "cmtuStatus") valor = statusJustificativaCmtu(row);
      if (chave === "cmtuPor") valor = porJustificativaCmtu(row);
      var amplo = /nature|instru|descricao|observ|justificativa|substitut/i.test(chave);
      lista.push({ chave: chave, rotulo: rotulo(chave), valor: texto(valor), amplo: amplo });
    });
    vistos.cmtuAprovado = 1;
    vistos.cmtuReprovado = 1;
    vistos.cmtuAprovadoPor = 1;
    vistos.cmtuReprovadoPor = 1;
    Object.keys(row).forEach(function (chave) {
      if (vistos[chave]) return;
      if (OCULTAS[String(chave).toLowerCase()]) return;
      if (chave === "incidentId" && String(row.incidentId) === String(row.id || "")) return;
      var valor = texto(row[chave]);
      lista.push({
        chave: chave,
        rotulo: rotulo(chave),
        valor: valor,
        amplo: valor.length > 80 || valor.indexOf("\n") >= 0
      });
    });
    return lista;
  }

  function garantir() {
    var overlay = document.getElementById("portalIncOverlay") || document.getElementById("mnIncOverlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "portalIncOverlay";
    overlay.className = "inc-pop-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="inc-pop-box" role="dialog" aria-modal="true" aria-labelledby="portalIncTitulo">' +
      '<div class="inc-pop-head"><div>' +
      '<h3 id="portalIncTitulo">Incidente</h3>' +
      '<p id="portalIncSub">Todos os campos do registro</p>' +
      "</div>" +
      '<button type="button" class="inc-pop-fechar" id="portalIncFechar" aria-label="Fechar">×</button>' +
      "</div>" +
      '<div class="inc-pop-grid" id="portalIncGrid"></div>' +
      '<div class="inc-pop-acoes"><a class="btn-ghost" id="portalIncCad" href="' + CAD_URL + '" target="_blank" rel="noopener">Abrir no CAD</a></div>' +
      "</div>";
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) fechar();
    });
    overlay.querySelector("#portalIncFechar").addEventListener("click", fechar);
    if (!window.__portalIncEsc) {
      window.__portalIncEsc = true;
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") fechar();
      });
    }
    return overlay;
  }

  function nos() {
    garantir();
    var overlay = document.getElementById("portalIncOverlay") || document.getElementById("mnIncOverlay");
    return {
      overlay: overlay,
      titulo: document.getElementById("portalIncTitulo") || document.getElementById("mnIncPopTitulo"),
      sub: document.getElementById("portalIncSub") || document.getElementById("mnIncPopSub"),
      grid: document.getElementById("portalIncGrid") || document.getElementById("mnIncPopGrid"),
      cad: document.getElementById("portalIncCad") || document.getElementById("mnIncPopCad"),
      fecharBtn: document.getElementById("portalIncFechar") || document.getElementById("mnIncPopFechar")
    };
  }

  function fechar() {
    var overlay = document.getElementById("portalIncOverlay") || document.getElementById("mnIncOverlay");
    if (overlay) overlay.hidden = true;
  }

  function abrir(row) {
    if (!row) return;
    var ui = nos();
    var id = pick(row, ["id", "incidentId", "registro"]);
    if (ui.titulo) ui.titulo.textContent = id ? "Incidente " + id : "Incidente";
    if (ui.sub) {
      ui.sub.textContent = [
        pick(row, ["data", "data_ref", "data_da_aberura"]),
        pick(row, ["hora"]),
        pick(row, ["veiculo", "prefixo"]),
        pick(row, ["linha"])
      ].filter(Boolean).join(" · ") || "Todos os campos do registro";
    }
    if (ui.grid) {
      ui.grid.innerHTML = campos(row).map(function (c) {
        return '<div class="inc-pop-item mn-inc-pop-item' + (c.amplo ? " amplo" : "") + '"><span>' + esc(c.rotulo) + "</span><strong>" + esc(c.valor) + "</strong></div>";
      }).join("");
    }
    if (ui.cad) ui.cad.href = CAD_URL;
    ui.overlay.hidden = false;
    ui.fecharBtn && ui.fecharBtn.focus();
    if (id && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).catch(function () {});
    }
  }

  window.PortalIncidentePopup = { abrir: abrir, fechar: fechar };
})();
