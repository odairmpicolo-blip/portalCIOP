(function () {
  var CORES = ["#06245c", "#ff6b00", "#0891b2", "#7c3aed", "#059669", "#dc2626", "#d97706", "#2563eb"];
  var PREFERIDAS = [
    "id", "id_incidente", "codigo", "incidente",
    "data", "data_ref", "dt_incidente", "dt",
    "hora", "horario", "hora_inicio",
    "veiculo", "prefixo", "carro", "bus",
    "linha", "codigo_linha", "cod_linha",
    "tipo", "tipo_incidente",
    "natureza", "categoria", "grupo",
    "motorista", "nome_motorista",
    "analista", "usuario", "criado_por",
    "aberto_por", "opened_by", "aberto_para", "opened_for",
    "departamento", "department", "setor",
    "estado", "status", "situacao",
    "descricao", "observacao", "comentario", "detalhe", "detalhes"
  ];
  var OCULTAS = { payload: 1, html: 1, xml: 1, foto: 1, image: 1, blob: 1 };
  var state = {
    all: [],
    filtrados: [],
    colunas: [],
    colunasApi: [],
    page: 1,
    pageSize: 100,
    origem: "arquivo",
    carregando: false,
    atualizadoEm: "",
    totalBanco: 0,
    jsonCount: 0,
    sortKey: "",
    sortDir: "asc"
  };

  var KEYS_ABERTO_POR = ["aberto_por", "opened_by", "openedby", "criado_por", "created_by", "usuario_abertura"];
  var KEYS_ABERTO_PARA = ["aberto_para", "opened_for", "openedfor", "aberto_a", "assigned_to", "atribuido_para", "destinatario"];
  var KEYS_DEPTO = ["departamento", "department", "setor", "area"];

  function $(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(n) { return Number(n || 0).toLocaleString("pt-BR"); }
  function normKey(k) {
    return String(k || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
  }
  function rotulo(k) {
    var n = normKey(k);
    var mapa = {
      id: "ID", idincidente: "ID", codigo: "Código", incidente: "Incidente",
      data: "Data", dataref: "Data", dtincidente: "Data", dt: "Data",
      hora: "Hora", horario: "Hora", horainicio: "Hora",
      veiculo: "Veículo", prefixo: "Prefixo", carro: "Carro",
      linha: "Linha", codigolinha: "Linha",
      tipo: "Tipo", tipoincidente: "Tipo",
      natureza: "Natureza", categoria: "Categoria", grupo: "Grupo",
      motorista: "Motorista", nomemotorista: "Motorista",
      analista: "Analista", usuario: "Usuário", criadopor: "Criado por",
      abertopor: "Aberto por", openedby: "Aberto por",
      abertopara: "Aberto para", openedfor: "Aberto para",
      departamento: "Departamento", department: "Departamento", setor: "Departamento",
      estado: "Status", status: "Status", situacao: "Situação",
      descricao: "Descrição", observacao: "Observação", comentario: "Comentário",
      detalhe: "Detalhe", detalhes: "Detalhes"
    };
    if (mapa[n]) return mapa[n];
    return String(k || "").replace(/_/g, " ");
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
  function textoCelula(v) {
    if (v == null) return "";
    if (typeof v === "object") {
      try { return JSON.stringify(v); } catch (_) { return String(v); }
    }
    return String(v);
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
      if (typeof extra === "string") {
        try { extra = JSON.parse(extra); } catch (_) { extra = null; }
      }
      if (extra && typeof extra === "object" && !Array.isArray(extra)) {
        var m = Object.assign({}, r, extra);
        delete m.payload;
        return m;
      }
      return r;
    });
  }
  function mesAtual() {
    var br = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    var p = br.split("-");
    var y = Number(p[0]);
    var m = p[1];
    var ultimo = new Date(y, Number(m), 0).getDate();
    return { de: y + "-" + m + "-01", ate: y + "-" + m + "-" + String(ultimo).padStart(2, "0") };
  }
  function chaveLinha(r) {
    var id = String(get(r, ["id", "id_incidente", "codigo", "incidente"]) || "").trim();
    if (id) return "id:" + id;
    return [
      pickDate(r),
      pickHora(r),
      String(get(r, ["veiculo", "prefixo", "carro"])),
      String(get(r, ["linha", "codigo_linha"])),
      String(get(r, ["tipo", "tipo_incidente"]))
    ].join("|");
  }
  function mesclarItens(historico, mesAtualItens) {
    var mapa = new Map();
    (historico || []).forEach(function (r) { if (r) mapa.set(chaveLinha(r), r); });
    (mesAtualItens || []).forEach(function (r) { if (r) mapa.set(chaveLinha(r), r); });
    return Array.from(mapa.values());
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
    var raw = get(row, ["data", "data_ref", "dt_incidente", "dt", "created_at", "data_hora", "inicio", "date", "dia", "data_ocorrencia", "dt_cad"]);
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
    if (!el) return;
    var cur = el.value;
    var todas = id === "fLinha" || id === "fVeiculo" ? "Todas" : "Todos";
    el.innerHTML = '<option value="">' + todas + "</option>";
    values.forEach(function (v) {
      el.innerHTML += '<option value="' + esc(v) + '">' + esc(v) + "</option>";
    });
    if (values.indexOf(cur) >= 0) el.value = cur;
  }
  function setStatus(txt, cls) {
    $("statusLine").textContent = txt;
    $("statusDot").className = "status-dot " + (cls || "");
    if (cls === "erro") {
      var msg = window.portalMensagemErro ? window.portalMensagemErro({ message: txt }) : txt;
      if (window.portalMostrarAvisoDashboard) window.portalMostrarAvisoDashboard(msg);
    } else if ((cls === "ok" || cls === "load") && window.portalLimparAvisoDashboard) {
      window.portalLimparAvisoDashboard();
    }
  }

  function aplicarFiltros() {
    var busca = ($("fBusca").value || "").toLowerCase();
    var de = $("fDe").value;
    var ate = $("fAte").value;
    var linha = $("fLinha").value;
    var tipo = $("fTipo").value;
    var estado = $("fEstado").value;
    var veiculo = $("fVeiculo").value;
    var abertoPor = $("fAbertoPor") ? $("fAbertoPor").value : "";
    var abertoPara = $("fAbertoPara") ? $("fAbertoPara").value : "";
    var depto = $("fDepto") ? $("fDepto").value : "";
    state.filtrados = state.all.filter(function (r) {
      var d = pickDate(r);
      if (de && d && d < de) return false;
      if (ate && d && d > ate) return false;
      if (linha && String(get(r, ["linha", "codigo_linha"])) !== linha) return false;
      if (tipo && String(get(r, ["tipo", "tipo_incidente", "natureza"])) !== tipo) return false;
      if (estado && String(get(r, ["estado", "status", "situacao"])) !== estado) return false;
      if (veiculo && String(get(r, ["veiculo", "prefixo", "carro"])) !== veiculo) return false;
      if (abertoPor && String(get(r, KEYS_ABERTO_POR)) !== abertoPor) return false;
      if (abertoPara && String(get(r, KEYS_ABERTO_PARA)) !== abertoPara) return false;
      if (depto && String(get(r, KEYS_DEPTO)) !== depto) return false;
      if (!busca) return true;
      return JSON.stringify(r).toLowerCase().indexOf(busca) >= 0;
    });
    aplicarOrdem();
    state.page = 1;
    pintar();
  }

  function valorSort(r, col) {
    if (!col) return "";
    if (normKey(col.label) === "data" || /data/i.test(col.key || "")) return pickDate(r);
    if (normKey(col.label) === "hora" || /hora/i.test(col.key || "")) return pickHora(r);
    var v = col.key && r[col.key] != null && String(r[col.key]).trim() !== "" ? r[col.key] : get(r, col.keys);
    return textoCelula(v);
  }

  function aplicarOrdem() {
    if (!state.sortKey || !state.colunas.length) return;
    var col = state.colunas.find(function (c) { return c.key === state.sortKey; });
    if (!col) return;
    var dir = state.sortDir === "desc" ? -1 : 1;
    state.filtrados.sort(function (a, b) {
      var va = valorSort(a, col);
      var vb = valorSort(b, col);
      var c = String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" });
      return c * dir;
    });
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
    var linhas = uniqSorted(rows.map(function (r) { return String(get(r, ["linha", "codigo_linha"])); })).length;
    var veics = uniqSorted(rows.map(function (r) { return String(get(r, ["veiculo", "prefixo", "carro"])); })).length;
    var tipos = uniqSorted(rows.map(function (r) { return String(get(r, ["tipo", "tipo_incidente"])); })).length;
    var abertos = rows.filter(function (r) {
      return /aber|pend|andament|aguard/i.test(String(get(r, ["estado", "status", "situacao"])));
    }).length;
    var por = uniqSorted(rows.map(function (r) { return String(get(r, KEYS_ABERTO_POR)); }));
    var para = uniqSorted(rows.map(function (r) { return String(get(r, KEYS_ABERTO_PARA)); }));
    var deptos = uniqSorted(rows.map(function (r) { return String(get(r, KEYS_DEPTO)); }));
    var topPor = (topN(rows, KEYS_ABERTO_POR, 1)[0] || {}).k;
    var topPara = (topN(rows, KEYS_ABERTO_PARA, 1)[0] || {}).k;
    var topDepto = (topN(rows, KEYS_DEPTO, 1)[0] || {}).k;
    var bruto = state.totalBanco && state.totalBanco > state.all.length
      ? num(state.all.length) + " de " + num(state.totalBanco) + " no banco"
      : num(state.all.length) + " no banco";
    $("kpis").innerHTML = [
      ["Incidentes", num(rows.length), state.all.length ? bruto : "aguardando carga do 002"],
      ["Linhas", num(linhas), "no filtro"],
      ["Veículos", num(veics), "envolvidos"],
      ["Tipos", num(tipos), "categorias"],
      ["Aberto por", num(por.length), topPor && topPor !== "—" ? "mais: " + topPor : "pessoas distintas"],
      ["Aberto para", num(para.length), topPara && topPara !== "—" ? "mais: " + topPara : "destinos distintos"],
      ["Departamento", num(deptos.length), topDepto && topDepto !== "—" ? "mais: " + topDepto : "áreas distintas"],
      ["Em aberto", num(abertos), abertos ? "requerem atenção" : "nenhum pendente"]
    ].map(function (k) {
      return '<article class="kpi"><div class="label">' + k[0] + '</div><div class="value">' + k[1] + '</div><div class="sub">' + esc(k[2]) + "</div></article>";
    }).join("");
  }

  function descobrirColunas() {
    var ordem = [];
    var visto = {};
    function add(k) {
      if (!k || visto[k] || OCULTAS[normKey(k)]) return;
      visto[k] = 1;
      ordem.push(k);
    }
    (state.colunasApi || []).forEach(add);
    PREFERIDAS.forEach(function (p) {
      state.all.slice(0, 80).forEach(function (r) {
        Object.keys(r || {}).forEach(function (k) {
          if (normKey(k) === normKey(p)) add(k);
        });
      });
    });
    var contagem = {};
    state.all.slice(0, 120).forEach(function (r) {
      Object.keys(r || {}).forEach(function (k) {
        if (r[k] != null && String(r[k]).trim() !== "") contagem[k] = (contagem[k] || 0) + 1;
      });
    });
    Object.keys(contagem).sort(function (a, b) { return contagem[b] - contagem[a]; }).forEach(add);
    return ordem.map(function (k) {
      return { label: rotulo(k), key: k, keys: [k] };
    });
  }

  function celula(r, col) {
    if (normKey(col.label) === "data" || /data/i.test(col.key || "")) {
      var d = pickDate(r);
      if (d) return esc(d.split("-").reverse().join("/"));
    }
    if (normKey(col.label) === "hora" || /hora/i.test(col.key || "")) {
      var h = pickHora(r);
      if (h) return esc(h);
    }
    if (/status|estado|situacao/i.test(col.key || "") || /status|situa/i.test(col.label)) {
      return tagStatus(get(r, col.keys));
    }
    var v = col.key && r[col.key] != null && String(r[col.key]).trim() !== "" ? r[col.key] : get(r, col.keys);
    var t = textoCelula(v);
    if (t.length > 140) return '<span class="txt-clip" title="' + esc(t) + '">' + esc(t.slice(0, 140)) + "…</span>";
    return esc(t);
  }

  function pintarTabela() {
    var cols = state.colunas.length ? state.colunas : descobrirColunas();
    state.colunas = cols;
    $("tabelaHead").innerHTML = cols.map(function (c) {
      var cls = "th-ord";
      var icon = "↕";
      if (state.sortKey === c.key) {
        cls += state.sortDir === "desc" ? " ord-desc" : " ord-asc";
        icon = state.sortDir === "desc" ? "↓" : "↑";
      }
      return '<th class="' + cls + '" data-key="' + esc(c.key) + '" title="Ordenar A–Z"><span class="sort-label">' + esc(c.label) + ' <span class="sort-icon" aria-hidden="true">' + icon + "</span></span></th>";
    }).join("");
    var size = Number($("pageSize").value || state.pageSize);
    state.pageSize = size;
    var total = state.filtrados.length;
    var pages = Math.max(1, Math.ceil(total / size));
    if (state.page > pages) state.page = pages;
    var start = (state.page - 1) * size;
    var slice = state.filtrados.slice(start, start + size);
    $("subTabela").textContent = total
      ? num(total) + " registros · " + cols.length + " colunas · página " + state.page + " de " + pages
      : "Nenhum registro no filtro";
    $("pageInfo").textContent = total
      ? (start + 1) + "–" + Math.min(start + size, total) + " de " + num(total)
      : "0 registros";
    if (!slice.length) {
      $("tabelaBody").innerHTML = '<tr><td colspan="' + Math.max(cols.length, 1) + '"><div class="empty"><h3>Nenhum incidente neste recorte</h3><p>O histórico vem do JSON; o banco só entrega o mês atual. Ajuste o filtro ou atualize depois da carga.</p></div></td></tr>';
      return;
    }
    $("tabelaBody").innerHTML = slice.map(function (r, i) {
      var idx = start + i;
      return '<tr data-idx="' + idx + '" title="Clique para ver todos os campos">' + cols.map(function (c) {
        var cls = /tipo|motorista|analista|natureza|descricao|observ|id|detalh/i.test(c.label + c.key) ? ' class="txt"' : "";
        return "<td" + cls + ">" + celula(r, c) + "</td>";
      }).join("") + "</tr>";
    }).join("");
  }

  function abrirDetalhe(idx) {
    var r = state.filtrados[idx];
    var box = $("cadDetalhe");
    var body = $("cadDetalheBody");
    if (!r || !box || !body) return;
    var keys = Object.keys(r).filter(function (k) { return !OCULTAS[normKey(k)]; });
    body.innerHTML = keys.map(function (k) {
      return '<div class="det-row"><dt>' + esc(rotulo(k)) + '</dt><dd>' + esc(textoCelula(r[k])) + "</dd></div>";
    }).join("") || "<p>Sem campos.</p>";
    box.hidden = false;
  }

  function pintar() {
    if (!state.colunas.length && state.all.length) state.colunas = descobrirColunas();
    aplicarOrdem();
    pintarKpis();
    var tipos = topN(state.filtrados, ["tipo", "tipo_incidente", "natureza"], 8);
    donut(tipos, state.filtrados.length);
    barras($("chartLinha"), topN(state.filtrados, ["linha", "codigo_linha"], 6));
    barras($("chartEstado"), topN(state.filtrados, ["estado", "status", "situacao"], 6));
    barras($("chartAbertoPor"), topN(state.filtrados, KEYS_ABERTO_POR, 6));
    barras($("chartAbertoPara"), topN(state.filtrados, KEYS_ABERTO_PARA, 6));
    barras($("chartDepto"), topN(state.filtrados, KEYS_DEPTO, 6));
    pintarTabela();
    $("origemPill").textContent = state.origem + (state.atualizadoEm ? " · " + state.atualizadoEm : "");
  }

  function popularFiltros() {
    fillSelect("fLinha", uniqSorted(state.all.map(function (r) { return String(get(r, ["linha", "codigo_linha"])); })));
    fillSelect("fTipo", uniqSorted(state.all.map(function (r) { return String(get(r, ["tipo", "tipo_incidente"])); })));
    fillSelect("fEstado", uniqSorted(state.all.map(function (r) { return String(get(r, ["estado", "status", "situacao"])); })));
    fillSelect("fVeiculo", uniqSorted(state.all.map(function (r) { return String(get(r, ["veiculo", "prefixo", "carro"])); })));
    fillSelect("fAbertoPor", uniqSorted(state.all.map(function (r) { return String(get(r, KEYS_ABERTO_POR)); })));
    fillSelect("fAbertoPara", uniqSorted(state.all.map(function (r) { return String(get(r, KEYS_ABERTO_PARA)); })));
    fillSelect("fDepto", uniqSorted(state.all.map(function (r) { return String(get(r, KEYS_DEPTO)); })));
  }

  function receber(payload, origem, opcoes) {
    var novos = linhasDe(payload);
    if (opcoes && opcoes.mesclar && state.all.length) {
      state.all = mesclarItens(state.all, novos);
    } else {
      state.all = novos;
    }
    var colsApi = payload && payload.colunas ? payload.colunas : [];
    if (colsApi.length) {
      var visto = {};
      state.colunasApi = (state.colunasApi || []).concat(colsApi).filter(function (k) {
        if (visto[k]) return false;
        visto[k] = 1;
        return true;
      });
    }
    state.colunas = [];
    state.origem = origem || (payload && payload.origem) || "arquivo";
    var meta = payload && payload.meta;
    if (meta && (meta.total || meta.registros)) state.totalBanco = Number(meta.total || meta.registros) || 0;
    var quando = (payload && (payload.atualizadoEm || payload.atualizado_em)) || (meta && (meta.ultimoDia || meta.ultimo_dia));
    if (quando) state.atualizadoEm = String(quando).slice(0, 16).replace("T", " ");
    popularFiltros();
    aplicarFiltros();
  }

  async function carregarJson() {
    var res = await fetch("../assets/data/incidentes-cad.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("json " + res.status);
    var texto = await res.text();
    var t = String(texto || "").trim();
    if (!t || t.charAt(0) === "<") throw new Error("JSON local veio como HTML");
    return JSON.parse(t);
  }

  async function carregarBanco() {
    if (!window.Fonte || typeof Fonte.cad !== "function") return null;
    return Fonte.cad({ de: state.mesDe, ate: state.mesAte, limite: 400 });
  }

  async function iniciar() {
    if (state.carregando) return;
    state.carregando = true;
    var mes = mesAtual();
    state.mesDe = mes.de;
    state.mesAte = mes.ate;
    window.portalMostrarCarregando?.("Carregando Incidentes CAD");
    setStatus("Carregando…", "load");
    try {
      var json = await carregarJson();
      var nJson = linhasDe(json).length;
      state.jsonCount = nJson;
      if (nJson) {
        receber(json, "arquivo");
        window.portalOcultarCarregando?.();
        setStatus("Histórico JSON · " + num(nJson) + " · buscando o banco…", "load");
      } else {
        window.portalMostrarCarregando?.("Buscando cr_0002 no banco…");
      }
    } catch (e) {
      window.portalMostrarCarregando?.("Buscando cr_0002 no banco…");
    }
    await esperarAuth();
    if (!state.all.length) window.portalMostrarCarregando?.("Carregando registros do CAD…");
    setStatus("Buscando o CAD do mês atual…", "load");
    try {
      var banco = await carregarBanco();
      if (banco && banco.ok === false && !linhasDe(banco).length) {
        throw new Error(banco.erro || "API CAD recusou a leitura");
      }
      var bruto = banco ? linhasDe(banco) : [];
      var nMes = bruto.length;
      var totalTab = Number(banco && banco.meta && (banco.meta.totalTabela || banco.meta.total)) || nMes;
      if (nMes) {
        receber({ itens: bruto, colunas: banco.colunas, meta: banco.meta, origem: banco.origem }, state.jsonCount ? "json + banco" : "banco", { mesclar: Boolean(state.jsonCount) });
        setStatus("Banco cr_0002 · " + num(state.all.length) + " registros" + (totalTab > nMes ? " de " + num(totalTab) : "") + (state.jsonCount ? " + JSON " + num(state.jsonCount) : ""), "ok");
      } else if (state.all.length) {
        setStatus("Histórico JSON · " + num(state.all.length) + " · mês atual ainda sem linhas no banco", "ok");
      } else {
        setStatus((banco && banco.erro) ? banco.erro : "Sem histórico no JSON e cr_0002 vazio neste mês. Atualize depois da carga.", "load");
      }
    } catch (e2) {
      if (!state.all.length) setStatus("Não foi possível ler o CAD. " + (e2.message || e2), "erro");
      else setStatus("Histórico JSON · banco do mês indisponível (" + (e2.message || e2) + ")", "ok");
    }
    state.carregando = false;
    window.portalOcultarCarregando?.();
  }

  function csv() {
    var cols = state.colunas.length ? state.colunas : descobrirColunas();
    var lines = [cols.map(function (c) { return c.label; }).join(";")];
    state.filtrados.forEach(function (r) {
      lines.push(cols.map(function (c) {
        var v = c.key && r[c.key] != null ? textoCelula(r[c.key]) : textoCelula(get(r, c.keys));
        if (normKey(c.label) === "data") v = pickDate(r) || v;
        if (normKey(c.label) === "hora") v = pickHora(r) || v;
        return '"' + String(v || "").replace(/"/g, '""') + '"';
      }).join(";"));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "incidentes-cad.csv";
    a.click();
  }

  function ligar() {
    ["fBusca", "fDe", "fAte", "fLinha", "fTipo", "fEstado", "fVeiculo", "fAbertoPor", "fAbertoPara", "fDepto", "pageSize"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.addEventListener("input", aplicarFiltros);
      el.addEventListener("change", aplicarFiltros);
    });
    $("btnLimpar").addEventListener("click", function () {
      ["fBusca", "fDe", "fAte", "fLinha", "fTipo", "fEstado", "fVeiculo", "fAbertoPor", "fAbertoPara", "fDepto"].forEach(function (id) { if ($(id)) $(id).value = ""; });
      aplicarFiltros();
    });
    $("btnAtualizar").addEventListener("click", iniciar);
    $("btnCsv").addEventListener("click", csv);
    $("prevPage").addEventListener("click", function () { if (state.page > 1) { state.page--; pintarTabela(); } });
    $("nextPage").addEventListener("click", function () {
      var pages = Math.max(1, Math.ceil(state.filtrados.length / state.pageSize));
      if (state.page < pages) { state.page++; pintarTabela(); }
    });
    $("tabelaHead").addEventListener("click", function (ev) {
      var th = ev.target.closest("th[data-key]");
      if (!th) return;
      var key = th.getAttribute("data-key");
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else { state.sortKey = key; state.sortDir = "asc"; }
      aplicarOrdem();
      state.page = 1;
      pintarTabela();
    });
    $("tabelaBody").addEventListener("click", function (ev) {
      var tr = ev.target.closest("tr[data-idx]");
      if (!tr) return;
      abrirDetalhe(Number(tr.getAttribute("data-idx")));
    });
    var fechar = $("cadDetalheFechar");
    var fundo = $("cadDetalhe");
    if (fechar) fechar.addEventListener("click", function () { fundo.hidden = true; });
    if (fundo) fundo.addEventListener("click", function (ev) { if (ev.target === fundo) fundo.hidden = true; });
  }

  window.IncidentesCad = { iniciar: iniciar, ligar: ligar };
})();
