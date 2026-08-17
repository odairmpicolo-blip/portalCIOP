(function () {
  var PAGE = 100;
  var CORES = ["#06245c", "#ff6b00", "#0891b2", "#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb"];
  var state = {
    all: [],
    filtrados: [],
    page: 1,
    pageSize: 100,
    origem: "arquivo",
    carregando: false,
    atualizadoEm: ""
  };

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(n) { return Number(n || 0).toLocaleString("pt-BR"); }
  function normKey(k) {
    return String(k || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
  }
  function get(row, keys) {
    if (!row) return "";
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (row[k] != null && String(row[k]).trim() !== "") return row[k];
    }
    var lower = {};
    Object.keys(row).forEach(function (k) { lower[normKey(k)] = row[k]; });
    for (var j = 0; j < keys.length; j++) {
      var lk = normKey(keys[j]);
      if (lower[lk] != null && String(lower[lk]).trim() !== "") return lower[lk];
    }
    for (var h = 0; h < keys.length; h++) {
      var hint = normKey(keys[h]);
      if (!hint) continue;
      var found = Object.keys(lower).find(function (k) { return k.indexOf(hint) >= 0; });
      if (found && lower[found] != null && String(lower[found]).trim() !== "") return lower[found];
    }
    return "";
  }
  function linhasDe(payload) {
    if (!payload) return [];
    var arr = [];
    if (Array.isArray(payload)) arr = payload;
    else if (Array.isArray(payload.itens)) arr = payload.itens;
    else if (Array.isArray(payload.rows)) arr = payload.rows;
    else if (Array.isArray(payload.incidentes)) arr = payload.incidentes;
    else if (payload.payload && Array.isArray(payload.payload.incidentes)) arr = payload.payload.incidentes;
    else if (payload.payload && Array.isArray(payload.payload.itens)) arr = payload.payload.itens;
    return arr.map(function (r) {
      if (!r || typeof r !== "object") return r;
      var extra = r.payload;
      if (extra && typeof extra === "object" && !Array.isArray(extra)) {
        return Object.assign({}, r, extra);
      }
      return r;
    });
  }
  function esperarAuth() {
    return new Promise(function (resolve) {
      if (window.portalUsuarioValidado) return resolve();
      if (typeof window.portalAguardarUsuario === "function") {
        window.portalAguardarUsuario(function () { resolve(); });
        return;
      }
      window.addEventListener("portal:usuario-validado", function () { resolve(); }, { once: true });
      setTimeout(resolve, 12000);
    });
  }
  function pickDate(row) {
    var raw = get(row, ["data", "data_ref", "dt_incidente", "dt", "created_at", "data_hora", "inicio"]);
    var s = String(raw || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var m = String(raw || "").match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "";
  }
  function pickHora(row) {
    var raw = get(row, ["hora", "horario", "hora_inicio", "data_hora"]);
    var s = String(raw || "");
    var m = s.match(/(\d{2}:\d{2})/);
    return m ? m[1] : s.slice(11, 16);
  }
  function uniqSorted(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
    });
  }
  function fillSelect(id, values) {
    var el = $(id);
    var cur = el.value;
    el.innerHTML = '<option value="">' + (id === "fLinha" ? "Todas" : "Todos") + "</option>";
    values.forEach(function (v) {
      el.innerHTML += '<option value="' + esc(v) + '">' + esc(v) + "</option>";
    });
    if (values.indexOf(cur) >= 0) el.value = cur;
  }
  function setStatus(txt, cls) {
    $("statusLine").textContent = txt;
    $("statusDot").className = "status-dot " + (cls || "");
  }

  function aplicarFiltros() {
    var busca = ($("fBusca").value || "").toLowerCase();
    var de = $("fDe").value;
    var ate = $("fAte").value;
    var linha = $("fLinha").value;
    var tipo = $("fTipo").value;
    var estado = $("fEstado").value;
    var veiculo = $("fVeiculo").value;
    state.filtrados = state.all.filter(function (r) {
      var d = pickDate(r);
      if (de && d && d < de) return false;
      if (ate && d && d > ate) return false;
      if (linha && String(get(r, ["linha", "codigo_linha"])) !== linha) return false;
      if (tipo && String(get(r, ["tipo", "tipo_incidente", "natureza"])) !== tipo) return false;
      if (estado && String(get(r, ["estado", "status", "situacao"])) !== estado) return false;
      if (veiculo && String(get(r, ["veiculo", "prefixo", "carro"])) !== veiculo) return false;
      if (!busca) return true;
      return JSON.stringify(r).toLowerCase().indexOf(busca) >= 0;
    });
    state.page = 1;
    pintar();
  }

  function topN(rows, keys, n) {
    var m = {};
    rows.forEach(function (r) {
      var k = String(get(r, keys) || "—");
      m[k] = (m[k] || 0) + 1;
    });
    return Object.keys(m).map(function (k) { return { k: k, n: m[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, n);
  }

  function barras(el, items) {
    if (!items.length) {
      el.innerHTML = '<div class="empty"><p>Sem dados para o filtro atual.</p></div>';
      return;
    }
    var max = items[0].n || 1;
    el.innerHTML = items.map(function (it) {
      var pct = Math.max(6, Math.round(100 * it.n / max));
      return '<div class="bar-row"><div class="bar-label" title="' + esc(it.k) + '">' + esc(it.k) +
        '</div><div class="bar-count">' + num(it.n) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
    }).join("");
  }

  function donut(items, total) {
    $("donutTotal").textContent = num(total);
    if (!items.length || !total) {
      $("donutTipo").style.background = "#e2e8f0";
      $("legendTipo").innerHTML = "<div>Sem tipos no recorte.</div>";
      return;
    }
    var acc = 0;
    var stops = items.map(function (it, i) {
      var start = acc;
      acc += 100 * it.n / total;
      return CORES[i % CORES.length] + " " + start.toFixed(1) + "% " + acc.toFixed(1) + "%";
    });
    $("donutTipo").style.background = "conic-gradient(" + stops.join(",") + ")";
    $("legendTipo").innerHTML = items.map(function (it, i) {
      var pct = Math.round(100 * it.n / total);
      return '<div><i style="background:' + CORES[i % CORES.length] + '"></i>' + esc(it.k) + " · " + pct + "%</div>";
    }).join("");
  }

  function tagStatus(v) {
    var s = String(v || "—");
    var cls = "tag-info";
    var low = s.toLowerCase();
    if (/final|encerr|conclu|ok|resolv/.test(low)) cls = "tag-ok";
    else if (/aber|pend|andament|aguard/.test(low)) cls = "tag-warn";
    return '<span class="tag ' + cls + '">' + esc(s) + "</span>";
  }

  function pintarKpis() {
    var rows = state.filtrados;
    var hoje = new Date().toISOString().slice(0, 10);
    var hojeN = rows.filter(function (r) { return pickDate(r) === hoje; }).length;
    var linhas = uniqSorted(rows.map(function (r) { return String(get(r, ["linha", "codigo_linha"])); })).length;
    var veics = uniqSorted(rows.map(function (r) { return String(get(r, ["veiculo", "prefixo", "carro"])); })).length;
    var tipos = uniqSorted(rows.map(function (r) { return String(get(r, ["tipo", "tipo_incidente"])); })).length;
    var abertos = rows.filter(function (r) {
      return /aber|pend|andament|aguard/i.test(String(get(r, ["estado", "status", "situacao"])));
    }).length;
    $("kpis").innerHTML = [
      ["Incidentes", num(rows.length), state.all.length ? num(state.all.length) + " no recorte bruto" : "aguardando carga"],
      ["Hoje", num(hojeN), hoje],
      ["Linhas", num(linhas), "no filtro"],
      ["Veículos", num(veics), "envolvidos"],
      ["Tipos", num(tipos), "categorias"],
      ["Em aberto", num(abertos), abertos ? "requerem atenção" : "nenhum pendente"]
    ].map(function (k) {
      return '<article class="kpi"><div class="label">' + k[0] + '</div><div class="value">' + k[1] + '</div><div class="sub">' + k[2] + "</div></article>";
    }).join("");
  }

  var COLS_FIXAS = [
    { label: "ID", keys: ["id", "id_incidente", "codigo", "incidente"] },
    { label: "Data", keys: ["data", "data_ref", "dt_incidente", "dt"] },
    { label: "Hora", keys: ["hora", "horario", "hora_inicio"] },
    { label: "Veículo", keys: ["veiculo", "prefixo", "carro", "bus"] },
    { label: "Linha", keys: ["linha", "codigo_linha", "cod_linha"] },
    { label: "Tipo", keys: ["tipo", "tipo_incidente"] },
    { label: "Motorista", keys: ["motorista", "nome_motorista"] },
    { label: "Analista", keys: ["analista", "usuario", "criado_por"] },
    { label: "Status", keys: ["estado", "status", "situacao"] },
    { label: "Natureza", keys: ["natureza", "categoria", "grupo"] }
  ];

  function celula(r, col) {
    if (col.label === "Data") return esc(pickDate(r) || get(r, col.keys));
    if (col.label === "Hora") return esc(pickHora(r) || get(r, col.keys));
    if (col.label === "Status") return tagStatus(get(r, col.keys));
    var v = get(r, col.keys);
    if (v === "" && col.key) v = r[col.key] == null ? "" : r[col.key];
    return esc(v);
  }

  function colunasDaTabela() {
    var amostra = state.all[0];
    if (!amostra) return COLS_FIXAS;
    var cols = COLS_FIXAS.filter(function (c) {
      return get(amostra, c.keys) !== "" || (c.label === "Data" && pickDate(amostra)) || (c.label === "Hora" && pickHora(amostra));
    });
    if (cols.length >= 4) return cols;
    return Object.keys(amostra).slice(0, 12).map(function (k) {
      return { label: k.replace(/_/g, " "), keys: [k], key: k };
    });
  }

  function pintarTabela() {
    var cols = colunasDaTabela();
    $("tabelaHead").innerHTML = cols.map(function (c) { return "<th>" + esc(c.label) + "</th>"; }).join("");
    var size = Number($("pageSize").value || state.pageSize);
    state.pageSize = size;
    var total = state.filtrados.length;
    var pages = Math.max(1, Math.ceil(total / size));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * size;
    var slice = state.filtrados.slice(start, start + size);
    $("subTabela").textContent = total
      ? num(total) + " registros · página " + state.page + " de " + pages
      : "Nenhum registro no filtro";
    $("pageInfo").textContent = total
      ? (start + 1) + "–" + Math.min(start + size, total) + " de " + num(total)
      : "0 registros";
    if (!slice.length) {
      $("tabelaBody").innerHTML = '<tr><td colspan="' + cols.length + '"><div class="empty"><h3>Nenhum incidente neste recorte</h3><p>Ajuste os filtros ou aguarde a carga do relatório 002 (cr_0002).</p></div></td></tr>';
      return;
    }
    $("tabelaBody").innerHTML = slice.map(function (r) {
      return "<tr>" + cols.map(function (c) {
        var cls = /tipo|motorista|analista|natureza|id/i.test(c.label) ? ' class="txt"' : "";
        return "<td" + cls + ">" + celula(r, c) + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }

  function pintar() {
    pintarKpis();
    var tipos = topN(state.filtrados, ["tipo", "tipo_incidente", "natureza"], 8);
    donut(tipos, state.filtrados.length);
    barras($("chartLinha"), topN(state.filtrados, ["linha", "codigo_linha"], 8));
    barras($("chartEstado"), topN(state.filtrados, ["estado", "status", "situacao"], 8));
    pintarTabela();
    $("origemPill").textContent = state.origem + (state.atualizadoEm ? " · " + state.atualizadoEm : "");
  }

  function popularFiltros() {
    fillSelect("fLinha", uniqSorted(state.all.map(function (r) { return String(get(r, ["linha", "codigo_linha"])); })));
    fillSelect("fTipo", uniqSorted(state.all.map(function (r) { return String(get(r, ["tipo", "tipo_incidente"])); })));
    fillSelect("fEstado", uniqSorted(state.all.map(function (r) { return String(get(r, ["estado", "status", "situacao"])); })));
    fillSelect("fVeiculo", uniqSorted(state.all.map(function (r) { return String(get(r, ["veiculo", "prefixo", "carro"])); })));
  }

  function receber(payload, origem) {
    state.all = linhasDe(payload);
    state.origem = origem || (payload && payload.origem) || "arquivo";
    var meta = payload && payload.meta;
    var quando = (payload && (payload.atualizadoEm || payload.atualizado_em)) || (meta && (meta.ultimoDia || meta.ultimo_dia));
    state.atualizadoEm = quando ? String(quando).slice(0, 16).replace("T", " ") : "";
    popularFiltros();
    aplicarFiltros();
  }

  async function carregarJson() {
    var res = await fetch("../assets/data/incidentes-cad.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("json " + res.status);
    return res.json();
  }

  async function carregarBanco() {
    if (!window.Fonte || typeof Fonte.cad !== "function") return null;
    return Fonte.cad();
  }

  async function iniciar() {
    state.carregando = true;
    setStatus("Carregando arquivo local…", "load");
    try {
      var json = await carregarJson();
      receber(json, json.origem || "arquivo");
      setStatus((json.atualizadoEm ? "Arquivo · " + json.atualizadoEm : "Arquivo local") + " · " + num(state.all.length) + " registros", state.all.length ? "ok" : "load");
    } catch (e) {
      receber({ itens: [] }, "vazio");
      setStatus("Arquivo local vazio. Aguardando sessão para ler o banco…", "load");
    }
    await esperarAuth();
    setStatus("Buscando cr_0002 no banco…", "load");
    try {
      var banco = await carregarBanco();
      if (banco && banco.ok === false) {
        throw new Error(banco.erro || "API CAD recusou a leitura");
      }
      if (banco && linhasDe(banco).length) {
        receber(banco, banco.origem === "dsql" ? "banco" : (banco.origem || "banco"));
        var extra = banco.meta && (banco.meta.registros || banco.meta.total) && Number(banco.meta.registros || banco.meta.total) > state.all.length
          ? " (recorte de " + num(banco.meta.registros || banco.meta.total) + ")"
          : "";
        setStatus("Banco cr_0002 · " + num(state.all.length) + " registros" + extra, "ok");
      } else if (!state.all.length) {
        setStatus((banco && banco.erro) ? banco.erro : "A API respondeu, mas cr_0002 veio sem linhas.", "");
      } else {
        setStatus("Mantido arquivo local · banco sem linhas novas", "ok");
      }
    } catch (e2) {
      if (!state.all.length) setStatus("Não foi possível ler o CAD. " + (e2.message || e2), "");
      else setStatus("Arquivo local · banco indisponível (" + (e2.message || e2) + ")", "ok");
    }
    state.carregando = false;
  }

  function csv() {
    var cols = ["id", "data", "hora", "veiculo", "linha", "tipo", "motorista", "analista", "status", "natureza"];
    var lines = [cols.join(";")];
    state.filtrados.forEach(function (r) {
      lines.push([
        get(r, ["id", "id_incidente", "codigo"]),
        pickDate(r),
        pickHora(r),
        get(r, ["veiculo", "prefixo", "carro"]),
        get(r, ["linha", "codigo_linha"]),
        get(r, ["tipo", "tipo_incidente"]),
        get(r, ["motorista", "nome_motorista"]),
        get(r, ["analista", "usuario"]),
        get(r, ["estado", "status", "situacao"]),
        get(r, ["natureza", "categoria"])
      ].map(function (v) { return '"' + String(v || "").replace(/"/g, '""') + '"'; }).join(";"));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "incidentes-cad.csv";
    a.click();
  }

  function ligar() {
    ["fBusca", "fDe", "fAte", "fLinha", "fTipo", "fEstado", "fVeiculo", "pageSize"].forEach(function (id) {
      $(id).addEventListener("input", aplicarFiltros);
      $(id).addEventListener("change", aplicarFiltros);
    });
    $("btnLimpar").addEventListener("click", function () {
      ["fBusca", "fDe", "fAte", "fLinha", "fTipo", "fEstado", "fVeiculo"].forEach(function (id) { $(id).value = ""; });
      aplicarFiltros();
    });
    $("btnAtualizar").addEventListener("click", iniciar);
    $("btnCsv").addEventListener("click", csv);
    $("prevPage").addEventListener("click", function () { if (state.page > 1) { state.page--; pintarTabela(); } });
    $("nextPage").addEventListener("click", function () {
      var pages = Math.max(1, Math.ceil(state.filtrados.length / state.pageSize));
      if (state.page < pages) { state.page++; pintarTabela(); }
    });
  }

  window.IncidentesCad = { iniciar: iniciar, ligar: ligar };
})();
