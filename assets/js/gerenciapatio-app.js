/* Gerenciamento de Pátio — filas v4 (zonas + grade de vagas) */
(function () {
  const STORAGE_KEY = "patio_tcgl_v3";
  const FILA_PREF_KEY = "patio_ultima_fila_v1";

  const HORA_MINIMA_CORUJAO = "06:00";

  const GRUPOS_PATIO = [
    {
      id: "pesados",
      titulo: "Carros Pesados",
      filas: [
        { key: "pesados_f1", label: "Fila 1", ordem: 1, saidaLivre: true, capacidade: 20 },
        { key: "pesados_f2", label: "Fila 2", ordem: 2, capacidade: 22 },
        { key: "pesados_f3", label: "Fila 3", ordem: 3, capacidade: 23 },
        { key: "pesados_f4", label: "Fila 4", ordem: 4, capacidade: 24 }
      ]
    },
    {
      id: "mistos",
      titulo: "Carros mistos",
      filas: [
        { key: "mistos_f1", label: "Fila 1", ordem: 1, saidaLivre: true, capacidade: 15 },
        { key: "mistos_f2", label: "Fila 2", ordem: 2, capacidade: 15 },
        { key: "mistos_f3", label: "Fila 3", ordem: 3, capacidade: 29 },
        { key: "mistos_f4", label: "Fila 4", ordem: 4, capacidade: 34 }
      ]
    },
    {
      id: "leves",
      titulo: "Carros leves",
      filas: [
        { key: "leves_f1", label: "Fila 1", ordem: 1, saidaLivre: true, capacidade: 7 },
        { key: "leves_f2", label: "Fila 2", ordem: 2, capacidade: 0 },
        { key: "leves_f3", label: "Fila 3", ordem: 3, capacidade: 0 },
        { key: "leves_f4", label: "Fila 4", ordem: 4, capacidade: 0 }
      ]
    },
    {
      id: "corredor",
      titulo: "Corredor",
      filas: [
        { key: "corredor_c1", label: "Cor. 1", ordem: 1, saidaLivre: true, capacidade: 3 },
        { key: "corredor_c2", label: "Cor. 2", ordem: 2, saidaLivre: true, capacidade: 3 },
        { key: "corredor_c3", label: "Cor. 3", ordem: 3, saidaLivre: true, capacidade: 3 },
        { key: "corredor_c4", label: "Cor. 4", ordem: 4, saidaLivre: true, capacidade: 3 },
        { key: "corredor_c5", label: "Cor. 5", ordem: 5, saidaLivre: true, capacidade: 3 },
        { key: "corredor_c6", label: "Cor. 6", ordem: 6, saidaLivre: true, capacidade: 3 }
      ]
    },
    {
      id: "latavador",
      titulo: "Lavador",
      filas: [{ key: "latavador_f1", label: "Lavador", ordem: 1, saidaLivre: true, capacidade: 33 }]
    },
    {
      id: "cot",
      titulo: "COT",
      filas: [{ key: "cot", label: "COT", ordem: 1, saidaLivre: true }]
    },
    {
      id: "especiais",
      titulo: "Áreas especiais",
      filas: [
        { key: "muro", label: "Muro", ordem: 1, saidaLivre: true, capacidade: 35 },
        { key: "bomba", label: "Bomba", ordem: 1, saidaLivre: true, capacidade: 13 },
        { key: "corujao", label: "Corujão", ordem: 1, horarioMinimo: HORA_MINIMA_CORUJAO, capacidade: 5 }
      ]
    }
  ];

  const GRUPO_BLOQUEADOS = {
    id: "bloqueados",
    titulo: "Bloqueados",
    filas: [
      { key: "reforma", label: "Reforma", bloqueado: true },
      { key: "oficina", label: "Oficina", bloqueado: true }
    ]
  };

  const BLOQUEIO_VAGAS_PADRAO = {
    pesados_f1: [0],
    pesados_f3: Array.from({ length: 23 }, (_, i) => i),
    pesados_f4: Array.from({ length: 24 }, (_, i) => i)
  };

  const TODAS_FILAS = [
    ...GRUPOS_PATIO.flatMap((g) => g.filas),
    ...GRUPO_BLOQUEADOS.filas
  ];

  const FILA_MAP = Object.fromEntries(TODAS_FILAS.map((f) => [f.key, f]));
  const GRUPO_POR_FILA = {};
  GRUPOS_PATIO.forEach((g) => g.filas.forEach((f) => { GRUPO_POR_FILA[f.key] = g; }));
  GRUPO_BLOQUEADOS.filas.forEach((f) => { GRUPO_POR_FILA[f.key] = GRUPO_BLOQUEADOS; });

  const ROTULO_VAGA = {};

  function parseNumeroRotuloVaga(text) {
    const m = String(text || "").match(/(?:vaga|muro|bomba)\s*(\d+)/i);
    return m ? m[1] : null;
  }

  function aplicarCapacidadesGabarito() {
    const gab = window.GABARITO_GARAGEM;
    if (!gab?.capacidades) return;
    Object.entries(gab.capacidades).forEach(([key, n]) => {
      if (FILA_MAP[key]) FILA_MAP[key].capacidade = n;
    });
  }

  function construirRotulosGabarito() {
    Object.keys(ROTULO_VAGA).forEach((k) => { delete ROTULO_VAGA[k]; });
    const slots = window.GABARITO_GARAGEM?.slots;
    if (!Array.isArray(slots)) return;
    slots.forEach((s) => {
      const n = parseNumeroRotuloVaga(s.rotulo || s.label);
      ROTULO_VAGA[`${s.filaKey}:${s.slotIndex}`] = n || String(s.slotIndex + 1);
    });
  }

  function obterPlantaGaragem() {
    const gab = window.GABARITO_GARAGEM;
    if (gab?.layout) {
      return { ...PLANTA_GARAGEM, ...gab.layout };
    }
    return PLANTA_GARAGEM;
  }

  function obterRotuloVaga(filaKey, indice) {
    return ROTULO_VAGA[`${filaKey}:${indice}`] || String(indice + 1);
  }

  function filaVisivelNoMapa(filaKey) {
    if (ehFilaBloqueada(filaKey)) return true;
    if (filaUsaGrade(filaKey)) return obterCapacidadeFila(filaKey) > 0;
    return true;
  }

  const PLANTA_GARAGEM = {
    saidas: {
      norte: { titulo: "Norte", via: "Duque de Caxias", icone: "↑" },
      leste: { titulo: "Leste", via: "Messias Wilmar de Souza", icone: "→" },
      oeste: { titulo: "Oeste", via: "Rua Tietê", icone: "←" },
      sul: { titulo: "Sul", via: "José Dias Aro", icone: "↓" }
    },
    faixaNorte: [
      { key: "muro", label: "Muro", layout: "horizontal" },
      { key: "latavador_f1", label: "Lavador", layout: "lista" }
    ],
    oeste: [
      { key: "reforma", label: "Reforma", layout: "lista" },
      { key: "corujao", label: "Corujão", layout: "coluna" },
      { key: "cot", label: "COT", layout: "lista" },
      { key: "oficina", label: "Oficina", layout: "lista" }
    ],
    bomba: [{ key: "bomba", label: "Bomba", layout: "horizontal" }],
    mistos: [
      { key: "mistos_f1", label: "Fila 1" },
      { key: "mistos_f2", label: "Fila 2" },
      { key: "mistos_f3", label: "Fila 3" },
      { key: "mistos_f4", label: "Fila 4" }
    ],
    pesados: [
      { key: "pesados_f1", label: "Fila 1" },
      { key: "pesados_f2", label: "Fila 2" },
      { key: "pesados_f3", label: "Fila 3" },
      { key: "pesados_f4", label: "Fila 4" }
    ],
    corredor: [
      { key: "corredor_c1", label: "Cor. 1" },
      { key: "corredor_c2", label: "Cor. 2" },
      { key: "corredor_c3", label: "Cor. 3" },
      { key: "corredor_c4", label: "Cor. 4" },
      { key: "corredor_c5", label: "Cor. 5" },
      { key: "corredor_c6", label: "Cor. 6" }
    ],
    leves: [
      { key: "leves_f1", label: "Fila 1" },
      { key: "leves_f2", label: "Fila 2" },
      { key: "leves_f3", label: "Fila 3" },
      { key: "leves_f4", label: "Fila 4" }
    ]
  };

  aplicarCapacidadesGabarito();
  construirRotulosGabarito();

  function ehFilaBloqueada(filaKey) {
    return Boolean(FILA_MAP[filaKey]?.bloqueado);
  }

  function obterCapacidadeFila(filaKey) {
    return FILA_MAP[filaKey]?.capacidade || 0;
  }

  function filaUsaGrade(filaKey) {
    return obterCapacidadeFila(filaKey) > 0;
  }

  function criarBloqueioPadrao() {
    const bloqueio = {};
    Object.entries(BLOQUEIO_VAGAS_PADRAO).forEach(([k, v]) => { bloqueio[k] = [...v]; });
    return bloqueio;
  }

  function criarGradeVazia(filaKey) {
    const cap = obterCapacidadeFila(filaKey);
    return cap > 0 ? Array(cap).fill(null) : [];
  }

  function normalizarCarros(lista) {
    if (!Array.isArray(lista)) return [];
    return lista.filter((p) => p != null && String(p).trim() !== "");
  }

  function mapChaveLegado(key) {
    if (key === "caixa_dagua") return "mistos_f1";
    if (key.startsWith("corredor_")) return key;
    if (key === "oficina_f1" || key === "oficina_f2" || key === "bloqueados_oficina") return "oficina";
    return key;
  }

  function colocarCarrosNaGrade(filas, bloqueioVagas, filaKey, carros) {
    const cap = obterCapacidadeFila(filaKey);
    if (!cap) {
      filas[filaKey] = [...carros];
      return;
    }
    const bloqueadas = new Set(bloqueioVagas[filaKey] || []);
    const grade = criarGradeVazia(filaKey);
    let cursor = 0;
    carros.forEach((prefixo) => {
      while (cursor < cap && (bloqueadas.has(cursor) || grade[cursor])) cursor += 1;
      if (cursor >= cap) return;
      grade[cursor] = String(prefixo);
      cursor += 1;
    });
    filas[filaKey] = grade;
  }

  function obterBloqueioVagas(filaKey) {
    return patio.bloqueioVagas?.[filaKey] || BLOQUEIO_VAGAS_PADRAO[filaKey] || [];
  }

  function ehVagaBloqueada(filaKey, indice) {
    return obterBloqueioVagas(filaKey).includes(indice);
  }

  function contarCarrosFila(filaKey) {
    return (patio.filas[filaKey] || []).filter((p) => p != null && String(p).trim() !== "").length;
  }

  function primeiraVagaLivre(filaKey) {
    const cap = obterCapacidadeFila(filaKey);
    if (!cap) return -1;
    const bloqueadas = new Set(obterBloqueioVagas(filaKey));
    const grade = patio.filas[filaKey] || [];
    for (let i = 0; i < cap; i += 1) {
      if (bloqueadas.has(i)) continue;
      if (!grade[i]) return i;
    }
    return -1;
  }

  function corujaoDisponivel() {
    const d = new Date();
    const agora = d.getHours() * 60 + d.getMinutes();
    const [h, m] = HORA_MINIMA_CORUJAO.split(":").map(Number);
    return agora >= h * 60 + m;
  }

  function classeSaidaFila(filaCfg) {
    if (filaCfg.horarioMinimo) {
      return corujaoDisponivel() ? " saida-livre" : " corujao-aguardando";
    }
    if (filaCfg.saidaLivre) return " saida-livre";
    const ordem = filaCfg.ordem || 0;
    if (ordem >= 2 && ordem <= 4) return ` saida-ordem-${ordem}`;
    if (ordem >= 5) return " saida-ordem-seq";
    return "";
  }

  function classeBadgeOrdemSaida(ordemSaida) {
    if (ordemSaida === "1º" || ordemSaida === "LIVRE") return "livre";
    if (ordemSaida === "2º") return "ordem-2";
    if (ordemSaida === "3º") return "ordem-3";
    if (ordemSaida === "4º") return "ordem-4";
    return "seq";
  }

  function rotuloOrdemSaidaFila(filaKey, filaCfg) {
    const gab = window.GABARITO_GARAGEM?.ordemSaida?.[filaKey];
    if (gab) return gab === "LIVRE" ? "1º" : gab;
    if (filaCfg.horarioMinimo || filaCfg.saidaLivre) return "1º";
    const ordem = filaCfg.ordem || 0;
    if (ordem >= 2) return `${ordem}º`;
    if (ordem === 1) return "1º";
    return "";
  }

  function contarPedidos() {
    return patio.pedidos.length;
  }

  function criarFilasVazias() {
    const filas = {};
    TODAS_FILAS.forEach((f) => { filas[f.key] = criarGradeVazia(f.key); });
    return filas;
  }

  function migrarEstado(raw) {
    const pedidos = Array.isArray(raw?.pedidos) ? raw.pedidos : (raw?.rpl || []);
    const analisados = Array.isArray(raw?.analisados) ? raw.analisados : [];

    if (raw?.versao === 4 && raw.filas) {
      const filas = criarFilasVazias();
      const bloqueioVagas = criarBloqueioPadrao();
      Object.keys(filas).forEach((k) => {
        if (!Array.isArray(raw.filas[k])) return;
        if (filaUsaGrade(k)) {
          bloqueioVagas[k] = Array.isArray(raw.bloqueioVagas?.[k])
            ? [...raw.bloqueioVagas[k]]
            : [...(BLOQUEIO_VAGAS_PADRAO[k] || [])];
          colocarCarrosNaGrade(filas, bloqueioVagas, k, normalizarCarros(raw.filas[k]));
        } else {
          filas[k] = normalizarCarros(raw.filas[k]);
        }
      });
      Object.keys(filas).forEach((k) => {
        if (!filaUsaGrade(k)) return;
        const carros = normalizarCarros(filas[k]);
        colocarCarrosNaGrade(filas, bloqueioVagas, k, carros);
      });
      return { versao: 4, filas, bloqueioVagas, analisados, pedidos };
    }

    const legado = {};
    if (raw?.versao === 3 && raw.filas) {
      Object.entries(raw.filas).forEach(([k, v]) => { legado[k] = normalizarCarros(v); });
    } else if (raw && !raw.versao) {
      legado.muro = raw.filaMuro || [];
      legado.mistos_f1 = raw.fila1 || [];
      legado.mistos_f2 = raw.fila2 || [];
      legado.mistos_f3 = raw.fila3 || [];
      legado.mistos_f4 = raw.fila4 || [];
      legado.oficina_f1 = raw.oficina || [];
    }

    const filas = criarFilasVazias();
    const bloqueioVagas = criarBloqueioPadrao();
    const acumulado = {};
    Object.entries(legado).forEach(([key, lista]) => {
      const dest = mapChaveLegado(key);
      if (!acumulado[dest]) acumulado[dest] = [];
      acumulado[dest].push(...lista);
    });
    Object.entries(acumulado).forEach(([filaKey, carros]) => {
      if (!filas[filaKey]) return;
      colocarCarrosNaGrade(filas, bloqueioVagas, filaKey, carros);
    });
    return { versao: 4, filas, bloqueioVagas, analisados, pedidos };
  }

  let patio = migrarEstado(
    JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
    || JSON.parse(localStorage.getItem("patio_tcgl_v2") || "null")
  );

  const frotaDados = window.FROTA_PATIO || [];
  const FROTA_SET = new Set(frotaDados.map((item) => String(item.veiculo)));
  let lancamentoEmAndamento = false;
  let pedidoEmAndamento = false;
  let modoVisualizacaoMapa = "gabarito";
  try {
    const salvo = localStorage.getItem("patio_modo_mapa_v1");
    if (salvo === "zonas" || salvo === "gabarito") modoVisualizacaoMapa = salvo;
  } catch (_) { /* ignore */ }

  function veiculoExisteNaFrota(prefixo) {
    return FROTA_SET.has(String(prefixo));
  }

  function mostrarErroLancamento(msg) {
    const erro = document.getElementById("lancamentoErro");
    const ok = document.getElementById("lancamentoOk");
    if (ok) ok.textContent = "";
    if (erro) erro.textContent = msg;
  }

  function mostrarOkLancamento(msg) {
    const erro = document.getElementById("lancamentoErro");
    const ok = document.getElementById("lancamentoOk");
    if (erro) erro.textContent = "";
    if (ok) ok.textContent = msg;
  }

  function limparFeedbackLancamento() {
    const erro = document.getElementById("lancamentoErro");
    const ok = document.getElementById("lancamentoOk");
    if (erro) erro.textContent = "";
    if (ok) ok.textContent = "";
  }

  function mostrarErroPedido(msg) {
    const erro = document.getElementById("pedidoErro");
    const ok = document.getElementById("pedidoOk");
    if (ok) ok.textContent = "";
    if (erro) erro.textContent = msg;
  }

  function mostrarOkPedido(msg) {
    const erro = document.getElementById("pedidoErro");
    const ok = document.getElementById("pedidoOk");
    if (erro) erro.textContent = "";
    if (ok) ok.textContent = msg;
  }

  function limparFeedbackPedido() {
    const erro = document.getElementById("pedidoErro");
    const ok = document.getElementById("pedidoOk");
    if (erro) erro.textContent = "";
    if (ok) ok.textContent = "";
  }

  function validarPedido(prefixo) {
    if (!prefixo) return { ok: false, msg: "Digite o prefixo do veículo." };
    if (!veiculoExisteNaFrota(prefixo)) {
      return { ok: false, msg: `Veículo ${prefixo} não existe na frota.` };
    }
    const loc = localizarVeiculo(prefixo);
    if (!loc) {
      return { ok: false, msg: `Veículo ${prefixo} não está no pátio. Lance-o antes de marcar como Pedido.` };
    }
    if (ehFilaBloqueada(loc.filaKey)) {
      return { ok: false, msg: `Veículo ${prefixo} está bloqueado — não é Pedido.` };
    }
    if (patio.pedidos.includes(prefixo)) {
      return { ok: false, msg: `Veículo ${prefixo} já está marcado como Pedido.` };
    }
    return { ok: true, loc };
  }

  function normalizarPrefixoInput(input) {
    if (!input) return "";
    const limpo = input.value.replace(/\D/g, "");
    if (input.value !== limpo) input.value = limpo;
    return limpo;
  }

  function salvarEstado() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patio));
  }

  function obterTecnologia(prefixo) {
    const veiculo = frotaDados.find((item) => item.veiculo == prefixo);
    if (!veiculo) return "—";
    if (veiculo.rotulo) return veiculo.rotulo;
    return [veiculo.cor, veiculo.tecnologia, veiculo.climatizacao].filter(Boolean).join(" · ") || "—";
  }

  function obterNomeFila(key) {
    const fila = FILA_MAP[key];
    if (!fila) return key;
    const grupo = GRUPO_POR_FILA[key];
    return grupo ? `${grupo.titulo} · ${fila.label}` : fila.label;
  }

  function localizarVeiculo(prefixo) {
    for (const [key, lista] of Object.entries(patio.filas)) {
      const idx = lista.findIndex((p) => p != null && String(p) == prefixo);
      if (idx !== -1) return { filaKey: key, posicao: idx };
    }
    return null;
  }

  function totalAlocados() {
    return Object.keys(patio.filas).reduce((s, key) => s + contarCarrosFila(key), 0);
  }

  function removerVeiculoDeTudo(prefixo) {
    Object.keys(patio.filas).forEach((k) => {
      if (filaUsaGrade(k)) {
        patio.filas[k] = patio.filas[k].map((p) => (String(p) == prefixo ? null : p));
      } else {
        patio.filas[k] = patio.filas[k].filter((p) => p != prefixo);
      }
    });
    patio.analisados = patio.analisados.filter((p) => p != prefixo);
    patio.pedidos = patio.pedidos.filter((p) => p != prefixo);
  }

  function popularDatalist() {
    const datalist = document.getElementById("frotaList");
    if (!datalist) return;
    datalist.innerHTML = "";
    frotaDados.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.veiculo;
      option.textContent = item.rotulo || obterTecnologia(item.veiculo);
      datalist.appendChild(option);
    });
  }

  function lerUltimaFila() {
    const saved = localStorage.getItem(FILA_PREF_KEY);
    return FILA_MAP[saved] ? saved : TODAS_FILAS[0].key;
  }

  function salvarUltimaFila(key) {
    if (!FILA_MAP[key]) return;
    localStorage.setItem(FILA_PREF_KEY, key);
  }

  function definirFilaSelecionada(key) {
    const select = document.getElementById("selectFila");
    if (!select || !FILA_MAP[key]) return;
    select.value = key;
    salvarUltimaFila(key);
  }

  function popularSelectFila() {
    const select = document.getElementById("selectFila");
    if (!select) return;
    const preferida = select.value && FILA_MAP[select.value] ? select.value : lerUltimaFila();
    select.innerHTML = "";

    const addGroup = (label, filas) => {
      const og = document.createElement("optgroup");
      og.label = label;
      filas.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.key;
        opt.textContent = `${f.label} (${contarCarrosFila(f.key)}${f.capacidade ? `/${f.capacidade}` : ""})`;
        og.appendChild(opt);
      });
      select.appendChild(og);
    };

    GRUPOS_PATIO.forEach((g) => addGroup(g.titulo, g.filas));
    addGroup(GRUPO_BLOQUEADOS.titulo, GRUPO_BLOQUEADOS.filas);

    select.value = FILA_MAP[preferida] ? preferida : TODAS_FILAS[0].key;
    salvarUltimaFila(select.value);
  }

  function obterAlocadosSet() {
    const set = new Set();
    Object.keys(patio.filas).forEach((key) => {
      (patio.filas[key] || []).forEach((p) => {
        if (p != null && String(p).trim()) set.add(String(p));
      });
    });
    return set;
  }

  function listarCarrosNaoUtilizados() {
    const alocados = obterAlocadosSet();
    return frotaDados
      .filter((item) => !alocados.has(String(item.veiculo)))
      .sort((a, b) => Number(a.veiculo) - Number(b.veiculo));
  }

  function renderizarListaNaoUtilizados() {
    const lista = document.getElementById("listaNaoUtilizados");
    const qtd = document.getElementById("naoUtilizadosQtd");
    if (!lista) return;

    const carros = listarCarrosNaoUtilizados();
    if (qtd) qtd.textContent = String(carros.length);

    if (!carros.length) {
      lista.innerHTML = '<span class="patio-nao-util-vazio">Todos os veículos estão alocados no pátio.</span>';
      return;
    }

    lista.innerHTML = carros
      .map((item) => {
        const rotulo = item.rotulo || obterTecnologia(item.veiculo);
        return `<span class="patio-nao-util-chip" title="${rotulo}">${item.veiculo}</span>`;
      })
      .join("");
  }

  function atualizarResumo() {
    const el = document.getElementById("patioResumo");
    if (!el) return;
    const alocados = totalAlocados();
    const fora = frotaDados.length - alocados;
    el.innerHTML = `
      <span><b>${frotaDados.length}</b> na frota</span>
      <span><b>${alocados}</b> no pátio</span>
      <span><b>${fora}</b> sem alocação</span>
      <span><b>${contarPedidos()}</b> pedidos</span>
    `;
  }

  function criarQuadroCarro(prefixo, filaKey) {
    const tech = obterTecnologia(prefixo);
    const filaCfg = FILA_MAP[filaKey] || {};
    const slot = document.createElement("div");
    let statusClass = "";

    if (filaCfg.bloqueado) {
      statusClass = "bloqueado-status";
    } else if (patio.pedidos.includes(prefixo)) {
      statusClass = "pedidos-status";
    }

    const btnPedido = filaCfg.bloqueado
      ? ""
      : `<button type="button" class="btn-pedido" title="Marcar/desmarcar Pedido" data-prefixo="${prefixo}">P</button>`;

    slot.className = `garagem-slot car-tag ${statusClass}`.trim();
    slot.title = `${prefixo} — ${tech}`;
    slot.innerHTML = `
      <span class="garagem-slot-prefixo">${prefixo}</span>
      <span class="garagem-slot-tech">${tech}</span>
      <div class="garagem-slot-actions">
        ${btnPedido}
        <button type="button" class="remove-btn" title="Remover" data-prefixo="${prefixo}">×</button>
      </div>
    `;
    return slot;
  }

  function criarSlotVazio(filaKey, indice) {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "garagem-slot garagem-slot-vazio";
    slot.title = "Clique para bloquear/desbloquear vaga";
    slot.dataset.fila = filaKey;
    slot.dataset.indice = String(indice);
    slot.innerHTML = "<span class=\"garagem-slot-vazio-label\">+</span>";
    slot.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleBloqueioVaga(filaKey, indice);
    });
    return slot;
  }

  function criarSlotBloqueado(filaKey, indice) {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "garagem-slot garagem-slot-bloqueada";
    slot.title = "Vaga bloqueada — clique para liberar";
    slot.dataset.fila = filaKey;
    slot.dataset.indice = String(indice);
    slot.setAttribute("aria-label", "Vaga bloqueada");
    slot.innerHTML = "<span class=\"garagem-slot-bloqueio-x\" aria-hidden=\"true\"></span>";
    slot.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleBloqueioVaga(filaKey, indice);
    });
    return slot;
  }

  function criarCelulaVaga(filaKey, indice) {
    const celula = document.createElement("div");
    celula.className = "patio-vaga-celula";
    const num = document.createElement("span");
    num.className = "patio-vaga-numero";
    num.textContent = obterRotuloVaga(filaKey, indice);
    celula.appendChild(num);

    const grade = patio.filas[filaKey] || [];
    if (ehVagaBloqueada(filaKey, indice)) {
      celula.appendChild(criarSlotBloqueado(filaKey, indice));
    } else if (grade[indice]) {
      celula.appendChild(criarQuadroCarro(grade[indice], filaKey));
    } else {
      celula.appendChild(criarSlotVazio(filaKey, indice));
    }
    return celula;
  }

  function criarCabecalhoFila(filaKey, label, variante = "linha") {
    const filaCfg = FILA_MAP[filaKey] || {};
    const qtd = contarCarrosFila(filaKey);
    const cap = obterCapacidadeFila(filaKey);
    const livre = classeSaidaFila(filaCfg);
    const bloq = filaCfg.bloqueado ? " bloqueado-lane" : "";
    const corujaoHint = filaCfg.horarioMinimo && !corujaoDisponivel()
      ? ` · após ${filaCfg.horarioMinimo}`
      : "";
    const ordemSaida = rotuloOrdemSaidaFila(filaKey, filaCfg);
    const ordemBadge = ordemSaida
      ? `<span class="patio-ordem-saida patio-ordem-saida--${classeBadgeOrdemSaida(ordemSaida)}" title="Ordem de saída">${ordemSaida}</span>`
      : "";

    const head = document.createElement("button");
    head.type = "button";
    head.dataset.fila = filaKey;

    if (variante === "coluna") {
      head.className = `garagem-col-head${livre}${bloq}`;
      const capTxt = cap ? ` · ${cap} vagas` : "";
      head.innerHTML = `${ordemBadge}${label}<small>${qtd} carro${qtd !== 1 ? "s" : ""}${capTxt}${corujaoHint}</small>`;
    } else {
      head.className = `patio-fila-head${livre}${bloq}`;
      head.innerHTML = `
        <span class="patio-fila-nome">${ordemBadge}${label}</span>
        <span class="patio-fila-meta">${cap ? `${qtd}/${cap} vagas` : `${qtd} carro${qtd !== 1 ? "s" : ""}`}${corujaoHint}</span>
      `;
    }
    return head;
  }

  function criarLinhaFilaHorizontal(filaKey, label) {
    const cap = obterCapacidadeFila(filaKey);
    const row = document.createElement("div");
    row.className = "patio-fila-linha";
    row.appendChild(criarCabecalhoFila(filaKey, label));

    const vagas = document.createElement("div");
    vagas.className = "patio-fila-vagas";
    if (filaUsaGrade(filaKey)) {
      for (let i = 0; i < cap; i += 1) {
        vagas.appendChild(criarCelulaVaga(filaKey, i));
      }
    } else {
      const carros = (patio.filas[filaKey] || []).filter((p) => p != null && String(p).trim());
      if (!carros.length) {
        vagas.innerHTML = "<span class=\"patio-fila-vazio\">Sem veículos</span>";
      } else {
        carros.forEach((prefixo) => vagas.appendChild(criarQuadroCarro(prefixo, filaKey)));
      }
    }
    row.append(vagas);
    return row;
  }

  function criarFaixaSaida(lado, cfg) {
    const faixa = document.createElement("div");
    faixa.className = `patio-saida patio-saida-${lado}`;
    faixa.innerHTML = `
      <span class="patio-saida-icone" aria-hidden="true">${cfg.icone}</span>
      <span class="patio-saida-texto">
        <strong>${cfg.titulo}</strong>
        <small>${cfg.via}</small>
      </span>
    `;
    return faixa;
  }

  function criarSecaoPlanta(titulo, subtitulo = "") {
    const sec = document.createElement("section");
    sec.className = "patio-secao";
    sec.innerHTML = `
      <div class="patio-secao-head">
        <h3 class="patio-secao-titulo">${titulo}</h3>
        ${subtitulo ? `<p class="patio-secao-sub">${subtitulo}</p>` : ""}
      </div>
    `;
    return sec;
  }

  function anexarOuvintesMapa(mapa) {
    mapa.querySelectorAll(".patio-fila-head, .garagem-col-head, .gab-faixa-head, .gab-td-lista-titulo").forEach((btn) => {
      btn.addEventListener("click", () => {
        definirFilaSelecionada(btn.dataset.fila);
        focarPrimeiraCelulaFila(btn.dataset.fila);
      });
    });

    mapa.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        liberarCarro(btn.dataset.prefixo);
      });
    });

    mapa.querySelectorAll(".btn-pedido").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePedido(btn.dataset.prefixo);
      });
    });
  }

  function mostrarStatusGabarito(msg, tipo = "ok") {
    const el = document.getElementById("gabaritoStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "gab-status-bar";
    if (!msg) return;
    if (tipo === "erro") el.classList.add("gab-status--erro");
    else if (tipo === "ok") el.classList.add("gab-status--ok");
    if (tipo !== "erro") {
      clearTimeout(mostrarStatusGabarito._timer);
      mostrarStatusGabarito._timer = setTimeout(() => {
        el.textContent = "";
        el.className = "gab-status-bar";
      }, 2800);
    }
  }

  function lerPrefixoCelula(input) {
    return String(input?.value || "").replace(/\D/g, "").trim();
  }

  function aplicarEstiloCelulaInput(input, filaKey, prefixo) {
    const p = String(prefixo || "");
    input.classList.toggle("is-pedido", Boolean(p && patio.pedidos.includes(p)));
    input.classList.toggle("is-bloq", ehFilaBloqueada(filaKey));
  }

  function removerVeiculoDoSlot(filaKey, indice) {
    const grade = patio.filas[filaKey];
    if (!grade) return null;
    const p = grade[indice];
    if (!p) return null;
    if (filaUsaGrade(filaKey)) grade[indice] = null;
    else grade.splice(indice, 1);
    return String(p);
  }

  function colocarVeiculoNoSlot(prefixo, filaKey, indice) {
    if (!Array.isArray(patio.filas[filaKey])) patio.filas[filaKey] = criarGradeVazia(filaKey);
    patio.filas[filaKey][indice] = String(prefixo);
  }

  function sincronizarInputGabarito(filaKey, indice) {
    const input = document.querySelector(
      `td.gab-td--vaga[data-fila="${filaKey}"][data-indice="${indice}"] .gab-cel-input`
    );
    if (!input) return;
    const grade = patio.filas[filaKey] || [];
    const val = grade[indice] ? String(grade[indice]) : "";
    input.value = val;
    input.dataset.valorAnterior = val;
    aplicarEstiloCelulaInput(input, filaKey, val);
  }

  function commitCelulaGabarito(input) {
    const td = input.closest(".gab-td--vaga");
    if (!td) return true;
    const filaKey = td.dataset.fila;
    const indice = Number(td.dataset.indice);
    const anterior = input.dataset.valorAnterior || "";
    const novo = lerPrefixoCelula(input);
    input.value = novo;

    if (novo === anterior) return true;

    if (!novo) {
      if (anterior) {
        removerVeiculoDoSlot(filaKey, indice);
        patio.pedidos = patio.pedidos.filter((p) => p !== anterior);
      }
      input.dataset.valorAnterior = "";
      aplicarEstiloCelulaInput(input, filaKey, "");
      salvarEstado();
      atualizarResumo();
      renderizarListaNaoUtilizados();
      return true;
    }

    if (!veiculoExisteNaFrota(novo)) {
      input.value = anterior;
      mostrarStatusGabarito(`Veículo ${novo} não existe na frota.`, "erro");
      input.select();
      return false;
    }

    const loc = localizarVeiculo(novo);
    if (loc && (loc.filaKey !== filaKey || loc.posicao !== indice)) {
      removerVeiculoDoSlot(loc.filaKey, loc.posicao);
      sincronizarInputGabarito(loc.filaKey, loc.posicao);
    } else if (anterior && anterior !== novo) {
      removerVeiculoDoSlot(filaKey, indice);
    }

    colocarVeiculoNoSlot(novo, filaKey, indice);
    if (ehFilaBloqueada(filaKey)) {
      patio.pedidos = patio.pedidos.filter((p) => p !== novo);
    }
    input.dataset.valorAnterior = novo;
    aplicarEstiloCelulaInput(input, filaKey, novo);
    salvarEstado();
    atualizarResumo();
    renderizarListaNaoUtilizados();
    mostrarStatusGabarito(`✓ ${novo} — ${obterNomeFila(filaKey)}`);
    return true;
  }

  function construirMatrizInputsGabarito(tabela) {
    const matriz = [];
    tabela.querySelectorAll("tr").forEach((tr) => {
      const row = [...tr.querySelectorAll(".gab-cel-input")];
      if (row.length) matriz.push(row);
    });
    return matriz;
  }

  function acharPosicaoInputGabarito(matriz, input) {
    for (let r = 0; r < matriz.length; r += 1) {
      const c = matriz[r].indexOf(input);
      if (c >= 0) return { r, c };
    }
    return null;
  }

  function focarCelulaRelativaGabarito(input, dr, dc) {
    const tabela = input.closest(".gab-tabela-excel");
    if (!tabela) return;
    const matriz = construirMatrizInputsGabarito(tabela);
    const pos = acharPosicaoInputGabarito(matriz, input);
    if (!pos) return;
    const nr = pos.r + dr;
    if (nr < 0 || nr >= matriz.length) return;
    const nc = Math.max(0, Math.min(matriz[nr].length - 1, pos.c + dc));
    const alvo = matriz[nr][nc];
    if (alvo) {
      alvo.focus();
      alvo.select();
    }
  }

  function avancarCelulaGabarito(input, sentido = 1) {
    const scroll = input.closest(".gab-viewport-fit");
    if (!scroll) return;
    const inputs = [...scroll.querySelectorAll(".gab-cel-input")];
    const i = inputs.indexOf(input);
    const alvo = inputs[i + sentido];
    if (alvo) {
      alvo.focus();
      alvo.select();
    }
  }

  function focarPrimeiraCelulaFila(filaKey) {
    const input = document.querySelector(
      `td.gab-td--vaga[data-fila="${filaKey}"] .gab-cel-input`
    );
    if (input) {
      input.focus();
      input.select();
      input.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function obterFocoGabarito() {
    const td = document.activeElement?.closest?.(".gab-td--vaga");
    if (!td) return null;
    return { fila: td.dataset.fila, indice: td.dataset.indice };
  }

  function restaurarFocoGabarito(ref) {
    if (!ref?.fila) return;
    const input = document.querySelector(
      `td.gab-td--vaga[data-fila="${ref.fila}"][data-indice="${ref.indice}"] .gab-cel-input`
    );
    input?.focus();
  }

  function configurarPlanilhaGabarito(scroll, tabela) {
    tabela.querySelectorAll(".gab-td--vaga").forEach((td) => {
      td.addEventListener("dblclick", (e) => {
        e.preventDefault();
        const filaKey = td.dataset.fila;
        const indice = Number(td.dataset.indice);
        if (td.querySelector(".gab-cel-bloq")) {
          toggleBloqueioVaga(filaKey, indice);
          return;
        }
        const input = td.querySelector(".gab-cel-input");
        if (input && !input.value.trim()) {
          toggleBloqueioVaga(filaKey, indice);
        }
      });
    });

    tabela.querySelectorAll(".gab-cel-input").forEach((input) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "");
      });
      input.addEventListener("focus", () => {
        tdClassAdd(input);
        input.select();
      });
      input.addEventListener("blur", () => {
        tdClassRemove(input);
        commitCelulaGabarito(input);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          if (commitCelulaGabarito(input)) {
            avancarCelulaGabarito(input, e.shiftKey ? -1 : 1);
          }
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          commitCelulaGabarito(input);
          focarCelulaRelativaGabarito(input, 1, 0);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          commitCelulaGabarito(input);
          focarCelulaRelativaGabarito(input, -1, 0);
          return;
        }
        if (e.key === "ArrowRight" && input.selectionStart === input.value.length) {
          e.preventDefault();
          commitCelulaGabarito(input);
          focarCelulaRelativaGabarito(input, 0, 1);
          return;
        }
        if (e.key === "ArrowLeft" && input.selectionStart === 0) {
          e.preventDefault();
          commitCelulaGabarito(input);
          focarCelulaRelativaGabarito(input, 0, -1);
        }
        if (e.key === "Escape") {
          input.value = input.dataset.valorAnterior || "";
          input.blur();
        }
      });
    });

    function tdClassAdd(inp) {
      inp.closest(".gab-td--vaga")?.classList.add("gab-td--ativa");
    }
    function tdClassRemove(inp) {
      inp.closest(".gab-td--vaga")?.classList.remove("gab-td--ativa");
    }
  }

  function renderizarMapaProfissional() {
    const mapa = document.getElementById("patioMap");
    if (!mapa) return;

    mapa.innerHTML = "";
    mapa.className = "patio-map garagem-planta";

    const plantaCfg = obterPlantaGaragem();
    const planta = document.createElement("div");
    planta.className = "garagem-planta-inner patio-planta-pro";

    const S = plantaCfg.saidas;
    planta.appendChild(criarFaixaSaida("norte", S.norte));

    const corpo = document.createElement("div");
    corpo.className = "patio-planta-corpo";
    corpo.appendChild(criarFaixaSaida("oeste", S.oeste));

    const centro = document.createElement("div");
    centro.className = "patio-planta-centro";

    const secNorte = criarSecaoPlanta("Entrada norte", "Muro e lavador — faixa superior da garagem");
    const norteCorpo = document.createElement("div");
    norteCorpo.className = "patio-secao-corpo";
    plantaCfg.faixaNorte.forEach(({ key, label, layout }) => {
      if (!filaVisivelNoMapa(key)) return;
      if (layout === "horizontal") {
        norteCorpo.appendChild(criarLinhaFilaHorizontal(key, label));
      } else {
        norteCorpo.appendChild(criarColunaGaragem(key, label, "patio-col-lista"));
      }
    });
    secNorte.appendChild(norteCorpo);
    centro.appendChild(secNorte);

    const secOeste = criarSecaoPlanta("Lateral oeste", "Reforma, Corujão, COT e Oficina");
    const oesteCorpo = document.createElement("div");
    oesteCorpo.className = "patio-oeste-grid";
    plantaCfg.oeste.forEach(({ key, label, layout }) => {
      if (!filaVisivelNoMapa(key)) return;
      if (layout === "coluna") {
        oesteCorpo.appendChild(criarColunaGaragem(key, label));
      } else {
        oesteCorpo.appendChild(criarColunaGaragem(key, label, "patio-col-lista"));
      }
    });
    secOeste.appendChild(oesteCorpo);
    centro.appendChild(secOeste);

    const secBomba = criarSecaoPlanta("Bomba");
    const bombaCorpo = document.createElement("div");
    bombaCorpo.className = "patio-secao-corpo";
    plantaCfg.bomba.forEach(({ key, label }) => {
      if (!filaVisivelNoMapa(key)) return;
      bombaCorpo.appendChild(criarLinhaFilaHorizontal(key, label));
    });
    secBomba.appendChild(bombaCorpo);
    centro.appendChild(secBomba);

    const secPatio = criarSecaoPlanta(
      "Pátio principal",
      "Filas conforme gabarito Excel — mistos à esquerda, pesados à direita"
    );
    const patioCorpo = document.createElement("div");
    patioCorpo.className = "patio-secao-corpo patio-linhas-gabarito";

    function montarDualMistosPesados(mistos, pesados) {
      const dual = document.createElement("div");
      dual.className = "patio-dual patio-dual-linha";
      const colMistos = document.createElement("div");
      colMistos.className = "patio-dual-col";
      if (mistos && filaVisivelNoMapa(mistos.key)) {
        colMistos.appendChild(criarLinhaFilaHorizontal(mistos.key, mistos.label));
      }
      const colPesados = document.createElement("div");
      colPesados.className = "patio-dual-col";
      if (pesados && filaVisivelNoMapa(pesados.key)) {
        colPesados.appendChild(criarLinhaFilaHorizontal(pesados.key, pesados.label));
      }
      dual.append(colMistos, colPesados);
      return dual;
    }

    if (Array.isArray(plantaCfg.linhasPatio) && plantaCfg.linhasPatio.length) {
      plantaCfg.linhasPatio.forEach((linha) => {
        const row = document.createElement("div");
        row.className = "patio-gabarito-linha";
        if (linha.leves && filaVisivelNoMapa(linha.leves.key)) {
          row.appendChild(criarLinhaFilaHorizontal(linha.leves.key, linha.leves.label));
        }
        row.appendChild(montarDualMistosPesados(linha.mistos, linha.pesados));
        patioCorpo.appendChild(row);
      });
    } else {
      const patioDual = document.createElement("div");
      patioDual.className = "patio-dual";
      const colMistos = document.createElement("div");
      colMistos.className = "patio-dual-col";
      colMistos.innerHTML = "<h4 class=\"patio-dual-titulo\">Carros mistos</h4>";
      const mistosCorpo = document.createElement("div");
      mistosCorpo.className = "patio-secao-corpo";
      (plantaCfg.mistos || []).forEach(({ key, label }) => {
        if (!filaVisivelNoMapa(key)) return;
        mistosCorpo.appendChild(criarLinhaFilaHorizontal(key, label));
      });
      colMistos.appendChild(mistosCorpo);
      const colPesados = document.createElement("div");
      colPesados.className = "patio-dual-col";
      colPesados.innerHTML = "<h4 class=\"patio-dual-titulo\">Carros pesados</h4>";
      const pesadosCorpo = document.createElement("div");
      pesadosCorpo.className = "patio-secao-corpo";
      (plantaCfg.pesados || []).forEach(({ key, label }) => {
        if (!filaVisivelNoMapa(key)) return;
        pesadosCorpo.appendChild(criarLinhaFilaHorizontal(key, label));
      });
      colPesados.appendChild(pesadosCorpo);
      patioDual.append(colMistos, colPesados);
      patioCorpo.appendChild(patioDual);
    }

    secPatio.appendChild(patioCorpo);
    centro.appendChild(secPatio);

    const secCorredor = criarSecaoPlanta("Corredor", "Cor. 1 a 6 — três vagas cada");
    secCorredor.appendChild(montarLinhaColunas(
      (plantaCfg.corredor || []).filter(({ key }) => filaVisivelNoMapa(key)),
      "patio-corredor-linha"
    ));
    centro.appendChild(secCorredor);

    const levesExtras = (plantaCfg.levesExtras || plantaCfg.leves || [])
      .filter(({ key }) => filaVisivelNoMapa(key));
    if (levesExtras.length) {
      const secLeves = criarSecaoPlanta("Carros leves");
      const levesCorpo = document.createElement("div");
      levesCorpo.className = "patio-secao-corpo";
      levesExtras.forEach(({ key, label }) => {
        levesCorpo.appendChild(criarLinhaFilaHorizontal(key, label));
      });
      secLeves.appendChild(levesCorpo);
      centro.appendChild(secLeves);
    }

    corpo.append(centro, criarFaixaSaida("leste", S.leste));
    planta.appendChild(corpo);
    planta.appendChild(criarFaixaSaida("sul", S.sul));

    mapa.appendChild(planta);
    anexarOuvintesMapa(mapa);
  }

  function toggleBloqueioVaga(filaKey, indice) {
    if (!filaUsaGrade(filaKey)) return;
    const grade = patio.filas[filaKey] || [];
    if (grade[indice]) {
      mostrarStatusGabarito("Remova o carro antes de bloquear a vaga.", "erro");
      return;
    }
    if (!patio.bloqueioVagas) patio.bloqueioVagas = criarBloqueioPadrao();
    const lista = new Set(patio.bloqueioVagas[filaKey] || []);
    if (lista.has(indice)) lista.delete(indice);
    else lista.add(indice);
    patio.bloqueioVagas[filaKey] = [...lista].sort((a, b) => a - b);
    salvarEstado();
    const foco = obterFocoGabarito();
    renderizarMapa();
    restaurarFocoGabarito(foco);
  }

  function criarColunaGaragem(filaKey, label, extraClass = "") {
    const filaCfg = FILA_MAP[filaKey] || {};
    const col = document.createElement("div");
    col.className = `garagem-col${extraClass ? ` ${extraClass}` : ""}`;

    const cap = obterCapacidadeFila(filaKey);
    col.appendChild(criarCabecalhoFila(filaKey, label, "coluna"));

    const slots = document.createElement("div");
    slots.className = "garagem-slots";
    slots.id = `fila_${filaKey}`;

    const carros = patio.filas[filaKey] || [];
    if (filaUsaGrade(filaKey)) {
      for (let i = 0; i < cap; i += 1) {
        slots.appendChild(criarCelulaVaga(filaKey, i));
      }
    } else if (!carros.length) {
      const vazio = document.createElement("div");
      vazio.className = "garagem-slot garagem-slot-vazio garagem-slot-livre";
      vazio.textContent = "—";
      slots.appendChild(vazio);
    } else {
      carros.forEach((prefixo) => {
        if (prefixo) slots.appendChild(criarQuadroCarro(prefixo, filaKey));
      });
    }

    col.append(slots);
    return col;
  }

  function montarLinhaColunas(cols, rowClass) {
    const row = document.createElement("div");
    row.className = rowClass;
    cols.forEach(({ key, label }) => {
      row.appendChild(criarColunaGaragem(key, label));
    });
    return row;
  }

  function renderizarMapa() {
    if (modoVisualizacaoMapa === "zonas") {
      renderizarMapaProfissional();
    } else {
      renderizarGabaritoCompleto();
    }
  }

  function definirModoVisualizacaoMapa(modo) {
    modoVisualizacaoMapa = modo === "zonas" ? "zonas" : "gabarito";
    try {
      localStorage.setItem("patio_modo_mapa_v1", modoVisualizacaoMapa);
    } catch (_) { /* ignore */ }
    const btnGab = document.getElementById("btnViewGabarito");
    const btnZon = document.getElementById("btnViewZonas");
    btnGab?.classList.toggle("is-active", modoVisualizacaoMapa === "gabarito");
    btnZon?.classList.toggle("is-active", modoVisualizacaoMapa === "zonas");
    btnGab?.setAttribute("aria-selected", modoVisualizacaoMapa === "gabarito" ? "true" : "false");
    btnZon?.setAttribute("aria-selected", modoVisualizacaoMapa === "zonas" ? "true" : "false");
    renderizarMapa();
  }

  function criarCabecalhoGabarito(filaKey, label) {
    const filaCfg = FILA_MAP[filaKey] || {};
    const qtd = contarCarrosFila(filaKey);
    const cap = obterCapacidadeFila(filaKey);
    const ordemSaida = rotuloOrdemSaidaFila(filaKey, filaCfg);
    const head = document.createElement("button");
    head.type = "button";
    head.className = `gab-faixa-head${classeSaidaFila(filaCfg)}${filaCfg.bloqueado ? " bloqueado-lane" : ""}`;
    head.dataset.fila = filaKey;
    head.innerHTML = `
      ${ordemSaida ? `<span class="patio-ordem-saida patio-ordem-saida--${classeBadgeOrdemSaida(ordemSaida)}">${ordemSaida}</span>` : ""}
      <span class="gab-faixa-nome">${label}</span>
      <span class="gab-faixa-meta">${cap ? `${qtd}/${cap}` : `${qtd} veíc.`}</span>
    `;
    return head;
  }

  function criarGabVaga(filaKey, indice) {
    const celula = criarCelulaVaga(filaKey, indice);
    celula.className = "gab-vaga";
    return celula;
  }

  function criarFaixaGabarito(filaKey, label, zonaCls = "") {
    if (!filaVisivelNoMapa(filaKey)) return null;
    const cap = obterCapacidadeFila(filaKey);
    const faixa = document.createElement("div");
    faixa.className = `gab-faixa${zonaCls ? ` ${zonaCls}` : ""}`;
    faixa.appendChild(criarCabecalhoGabarito(filaKey, label));

    const vagas = document.createElement("div");
    vagas.className = "gab-faixa-vagas";
    vagas.id = `fila_${filaKey}`;
    if (filaUsaGrade(filaKey)) {
      for (let i = 0; i < cap; i += 1) {
        vagas.appendChild(criarGabVaga(filaKey, i));
      }
    } else {
      const carros = (patio.filas[filaKey] || []).filter((p) => p != null && String(p).trim());
      if (!carros.length) {
        vagas.innerHTML = "<span class=\"gab-lista-vazio\">—</span>";
      } else {
        carros.forEach((prefixo) => vagas.appendChild(criarQuadroCarro(prefixo, filaKey)));
      }
    }
    faixa.appendChild(vagas);
    return faixa;
  }

  function criarZonaListaGabarito(filaKey, label) {
    const zona = document.createElement("div");
    zona.className = "gab-zona-lista";
    zona.appendChild(criarCabecalhoGabarito(filaKey, label));
    const lista = document.createElement("div");
    lista.className = "gab-zona-lista-corpo";
    lista.id = `fila_${filaKey}`;
    const carros = (patio.filas[filaKey] || []).filter((p) => p != null && String(p).trim());
    if (!carros.length) {
      lista.innerHTML = "<span class=\"gab-lista-vazio\">Sem veículos</span>";
    } else {
      carros.forEach((prefixo) => lista.appendChild(criarQuadroCarro(prefixo, filaKey)));
    }
    zona.appendChild(lista);
    return zona;
  }

  function criarColunaCorujaoGabarito() {
    const col = document.createElement("div");
    col.className = "gab-corujao-col";
    const faixa = criarFaixaGabarito("corujao", "Corujão", "gab-zona--corujao");
    if (faixa) col.appendChild(faixa);
    return col;
  }

  function criarLinhaPatioGabarito(linhaCfg) {
    const row = document.createElement("div");
    row.className = "gab-patio-linha";
    row.dataset.excelRow = String(linhaCfg.excelRow || "");

    const rotulo = document.createElement("div");
    rotulo.className = "gab-patio-linha-rotulo";
    rotulo.innerHTML = `<span>Linha ${linhaCfg.excelRow || ""}</span>`;
    row.appendChild(rotulo);

    const corpo = document.createElement("div");
    corpo.className = "gab-patio-linha-corpo";

    if (linhaCfg.leves) {
      const lev = criarFaixaGabarito(linhaCfg.leves.key, linhaCfg.leves.label, "gab-zona--leves");
      if (lev) corpo.appendChild(lev);
    }
    if (linhaCfg.mistos) {
      const mis = criarFaixaGabarito(linhaCfg.mistos.key, linhaCfg.mistos.label, "gab-zona--mistos");
      if (mis) corpo.appendChild(mis);
    }
    if (linhaCfg.pesados) {
      const pes = criarFaixaGabarito(linhaCfg.pesados.key, linhaCfg.pesados.label, "gab-zona--pesados");
      if (pes) corpo.appendChild(pes);
    }

    row.appendChild(corpo);
    return row;
  }

  function criarConteudoCelulaVagaExcel(filaKey, indice, cel) {
    const wrap = document.createElement("div");
    wrap.className = "gab-td-vaga-inner";

    const corpo = document.createElement("div");
    corpo.className = "gab-td-corpo";

    if (ehVagaBloqueada(filaKey, indice)) {
      const bloq = document.createElement("div");
      bloq.className = "gab-cel-bloq";
      bloq.title = "Vaga bloqueada — duplo clique para liberar";
      corpo.appendChild(bloq);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "gab-cel-input";
      input.inputMode = "numeric";
      input.pattern = "[0-9]*";
      input.maxLength = 6;
      input.autocomplete = "off";
      input.spellcheck = false;
      const grade = patio.filas[filaKey] || [];
      const prefixo = grade[indice] ? String(grade[indice]) : "";
      input.value = prefixo;
      input.dataset.valorAnterior = prefixo;
      input.setAttribute(
        "aria-label",
        `Vaga ${obterRotuloVaga(filaKey, indice) || cel.rotulo || ""} — ${obterNomeFila(filaKey)}`
      );
      aplicarEstiloCelulaInput(input, filaKey, prefixo);
      corpo.appendChild(input);
    }
    wrap.appendChild(corpo);
    return wrap;
  }

  function criarConteudoCelulaListaExcel(filaKey, cel) {
    const wrap = document.createElement("div");
    wrap.className = "gab-td-lista-inner";

    const titulo = document.createElement("button");
    titulo.type = "button";
    titulo.className = "gab-td-lista-titulo";
    titulo.dataset.fila = filaKey;
    titulo.textContent = cel.text || FILA_MAP[filaKey]?.label || filaKey;
    wrap.appendChild(titulo);

    const lista = document.createElement("div");
    lista.className = "gab-td-lista-carros";
    const carros = (patio.filas[filaKey] || []).filter((p) => p != null && String(p).trim());
    if (!carros.length) {
      lista.innerHTML = "<span class=\"gab-lista-vazio\">—</span>";
    } else {
      carros.forEach((prefixo) => lista.appendChild(criarQuadroCarro(prefixo, filaKey)));
    }
    wrap.appendChild(lista);
    return wrap;
  }

  function ehLinhaLegendaInternaGabarito(linha) {
    const textos = (linha.celulas || [])
      .map((cel) => String(cel.text || "").trim().toUpperCase())
      .filter(Boolean);
    if (!textos.length) return false;
    const legendas = new Set(["LIVRE", "1º", "2º", "3º", "4º"]);
    return textos.every((txt) => legendas.has(txt));
  }

  function renderizarGabaritoCompleto() {
    const mapa = document.getElementById("patioMap");
    if (!mapa) return;

    const grade = window.GABARITO_GARAGEM?.gradeCompleta;
    if (!grade?.linhas?.length) {
      renderizarGabaritoEspacial();
      return;
    }

    const foco = obterFocoGabarito();
    mapa.innerHTML = "";
    mapa.className = "patio-map gabarito-completo";

    const scroll = document.createElement("div");
    scroll.className = "gab-viewport-fit";
    scroll.setAttribute("tabindex", "0");
    scroll.setAttribute("aria-label", "Gabarito da garagem — planilha editável");

    const tabela = document.createElement("table");
    tabela.className = "gab-tabela-excel";
    tabela.setAttribute("role", "grid");
    tabela.setAttribute("aria-label", "Gabarito da garagem TCGL");

    const colgroup = document.createElement("colgroup");
    const colWidths = grade.colWidths || [];
    const totalColW = colWidths.reduce((s, w) => s + w, 0) || 1;
    colWidths.forEach((w) => {
      const col = document.createElement("col");
      col.style.width = `${((w / totalColW) * 100).toFixed(4)}%`;
      colgroup.appendChild(col);
    });
    tabela.appendChild(colgroup);

    const linhasVisiveis = grade.linhas.filter((linha) => !ehLinhaLegendaInternaGabarito(linha));
    const totalRowH = linhasVisiveis.reduce((s, l) => s + (l.h || 30), 0) || 1;

    linhasVisiveis.forEach((linha) => {
      const tr = document.createElement("tr");
      tr.style.height = `${((linha.h / totalRowH) * 100).toFixed(4)}%`;
      tr.dataset.gabRow = String(linha.r);

      linha.celulas.forEach((cel) => {
        const td = document.createElement("td");
        td.className = "gab-td";
        td.style.backgroundColor = cel.bg;
        td.style.color = cel.cor;
        if (cel.colSpan > 1) td.colSpan = cel.colSpan;
        if (cel.rowSpan > 1) td.rowSpan = cel.rowSpan;

        if (cel.tipo === "vaga" && cel.filaKey && cel.slotIndex >= 0) {
          td.classList.add("gab-td--vaga");
          td.dataset.fila = cel.filaKey;
          td.dataset.indice = String(cel.slotIndex);
          td.appendChild(criarConteudoCelulaVagaExcel(cel.filaKey, cel.slotIndex, cel));
        } else if (cel.tipo === "faixa") {
          td.classList.add("gab-td--faixa");
        } else if (cel.tipo === "via") {
          td.classList.add("gab-td--via");
          if (cel.viaPos === "topo") td.classList.add("gab-td--via-topo");
          if (cel.viaPos === "base") td.classList.add("gab-td--via-base");
          if (cel.viaPos === "leste") td.classList.add("gab-td--via-leste");
          td.textContent = cel.text;
          td.style.backgroundColor = cel.bg;
          td.style.color = cel.cor;
        } else if (cel.tipo === "lista" && cel.filaKey) {
          td.classList.add("gab-td--lista");
          td.dataset.fila = cel.filaKey;
          td.appendChild(criarConteudoCelulaListaExcel(cel.filaKey, cel));
        } else {
          td.classList.add("gab-td--rotulo");
          td.textContent = cel.text;
        }

        tr.appendChild(td);
      });

      tabela.appendChild(tr);
    });

    scroll.appendChild(tabela);
    mapa.appendChild(scroll);
    configurarPlanilhaGabarito(scroll, tabela);
    anexarOuvintesMapa(mapa);
    restaurarFocoGabarito(foco);
  }

  function renderizarGabaritoEspacial() {
    const mapa = document.getElementById("patioMap");
    if (!mapa) return;

    mapa.innerHTML = "";
    mapa.className = "patio-map gabarito-espacial";

    const gab = window.GABARITO_GARAGEM;
    const plantaCfg = obterPlantaGaragem();
    const S = plantaCfg.saidas || PLANTA_GARAGEM.saidas;

    const planta = document.createElement("div");
    planta.className = "gab-planta";

    const fonte = document.createElement("div");
    fonte.className = "gab-fonte";
    fonte.textContent = gab?.source
      ? `Planta baseada em: ${gab.source}`
      : "Planta operacional TCGL";
    planta.appendChild(fonte);

    planta.appendChild(criarFaixaSaida("norte", S.norte));

    const corpo = document.createElement("div");
    corpo.className = "gab-corpo";

    const viaOeste = criarFaixaSaida("oeste", S.oeste);
    viaOeste.classList.add("gab-via-lateral");
    corpo.appendChild(viaOeste);

    const area = document.createElement("div");
    area.className = "gab-area-principal";

    const faixaMuro = document.createElement("div");
    faixaMuro.className = "gab-linha-superior";
    const lavador = criarZonaListaGabarito("latavador_f1", "Lavador");
    faixaMuro.appendChild(lavador);
    const muro = criarFaixaGabarito("muro", "Muro", "gab-zona--muro");
    if (muro) faixaMuro.appendChild(muro);
    area.appendChild(faixaMuro);

    const meio = document.createElement("div");
    meio.className = "gab-meio";

    const oeste = document.createElement("div");
    oeste.className = "gab-bloco-oeste";
    oeste.appendChild(criarZonaListaGabarito("reforma", "Reforma"));
    oeste.appendChild(criarColunaCorujaoGabarito());
    oeste.appendChild(criarZonaListaGabarito("cot", "COT"));
    oeste.appendChild(criarZonaListaGabarito("oficina", "Oficina"));
    meio.appendChild(oeste);

    const centro = document.createElement("div");
    centro.className = "gab-bloco-centro";

    const bomba = criarFaixaGabarito("bomba", "Bomba", "gab-zona--bomba");
    if (bomba) {
      const bombaWrap = document.createElement("div");
      bombaWrap.className = "gab-linha-bomba";
      bombaWrap.appendChild(bomba);
      centro.appendChild(bombaWrap);
    }

    const patioTitulo = document.createElement("div");
    patioTitulo.className = "gab-patio-titulo";
    patioTitulo.textContent = "Pátio principal — disposição conforme gabarito Excel";
    centro.appendChild(patioTitulo);

    const patioLinhas = document.createElement("div");
    patioLinhas.className = "gab-patio-linhas";
    const linhas = plantaCfg.linhasPatio || [];
    if (linhas.length) {
      linhas.forEach((linha) => patioLinhas.appendChild(criarLinhaPatioGabarito(linha)));
    } else {
      (plantaCfg.mistos || []).forEach(({ key, label }) => {
        const f = criarFaixaGabarito(key, label, "gab-zona--mistos");
        if (f) patioLinhas.appendChild(f);
      });
      (plantaCfg.pesados || []).forEach(({ key, label }) => {
        const f = criarFaixaGabarito(key, label, "gab-zona--pesados");
        if (f) patioLinhas.appendChild(f);
      });
    }
    centro.appendChild(patioLinhas);

    const legenda = document.createElement("div");
    legenda.className = "gab-legenda-ordem";
    legenda.setAttribute("aria-label", "Ordem de saída");
    (plantaCfg.legendaOrdemSaida || ["1º", "2º", "3º", "4º"]).forEach((item) => {
      const chip = document.createElement("span");
      chip.className = `gab-legenda-chip${item === "1º" ? " is-livre" : ""}`;
      chip.textContent = item;
      legenda.appendChild(chip);
    });
    legenda.insertAdjacentHTML("beforeend", "<span class=\"gab-legenda-hint\">Ordem de saída entre filas (conforme gabarito)</span>");
    centro.appendChild(legenda);

    meio.appendChild(centro);

    const corredor = document.createElement("div");
    corredor.className = "gab-bloco-corredor";
    const corTitulo = document.createElement("div");
    corTitulo.className = "gab-corredor-titulo";
    corTitulo.textContent = "Corredor";
    corredor.appendChild(corTitulo);
    const corCorpo = document.createElement("div");
    corCorpo.className = "gab-corredor-colunas";
    (plantaCfg.corredor || []).forEach(({ key, label }) => {
      if (!filaVisivelNoMapa(key)) return;
      const col = document.createElement("div");
      col.className = "gab-corredor-item";
      const faixa = criarFaixaGabarito(key, label, "gab-zona--corredor");
      if (faixa) col.appendChild(faixa);
      corCorpo.appendChild(col);
    });
    corredor.appendChild(corCorpo);
    meio.appendChild(corredor);

    area.appendChild(meio);
    corpo.appendChild(area);

    const viaLeste = criarFaixaSaida("leste", S.leste);
    viaLeste.classList.add("gab-via-lateral");
    corpo.appendChild(viaLeste);

    planta.appendChild(corpo);
    planta.appendChild(criarFaixaSaida("sul", S.sul));

    mapa.appendChild(planta);
    anexarOuvintesMapa(mapa);
  }

  function renderizarPatio() {
    renderizarMapa();
    popularSelectFila();
    popularDatalist();
    atualizarResumo();
    renderizarListaNaoUtilizados();
    if (modoVisualizacaoMapa === "gabarito") {
      sincronizarTodosInputsGabarito();
    }
  }

  function sincronizarTodosInputsGabarito() {
    document.querySelectorAll(".gab-cel-input").forEach((input) => {
      const td = input.closest(".gab-td--vaga");
      if (!td) return;
      sincronizarInputGabarito(td.dataset.fila, Number(td.dataset.indice));
    });
  }

  function removerVeiculoDasFilas(prefixo) {
    Object.keys(patio.filas).forEach((k) => {
      if (filaUsaGrade(k)) {
        patio.filas[k] = patio.filas[k].map((p) => (String(p) == prefixo ? null : p));
      } else {
        patio.filas[k] = patio.filas[k].filter((p) => p != prefixo);
      }
    });
  }

  function colocarVeiculoNaFila(prefixo, filaKey) {
    if (filaUsaGrade(filaKey)) {
      const idx = primeiraVagaLivre(filaKey);
      if (idx < 0) return false;
      if (!Array.isArray(patio.filas[filaKey])) patio.filas[filaKey] = criarGradeVazia(filaKey);
      patio.filas[filaKey][idx] = String(prefixo);
      return true;
    }
    patio.filas[filaKey].push(String(prefixo));
    return true;
  }

  function filaTemVagaLivre(filaKey, prefixoIgnorar = "") {
    if (!filaUsaGrade(filaKey)) return true;
    const cap = obterCapacidadeFila(filaKey);
    const bloqueadas = new Set(obterBloqueioVagas(filaKey));
    const grade = patio.filas[filaKey] || [];
    for (let i = 0; i < cap; i += 1) {
      if (bloqueadas.has(i)) continue;
      const ocupante = grade[i];
      if (!ocupante || String(ocupante) === String(prefixoIgnorar)) return true;
    }
    return false;
  }

  function aplicarAlocacao(prefixo, filaKey, input, mensagemOk) {
    lancamentoEmAndamento = true;
    try {
      const locAtual = localizarVeiculo(prefixo);
      if (!filaTemVagaLivre(filaKey, prefixo) && locAtual?.filaKey !== filaKey) {
        mostrarErroLancamento(`Sem vaga livre em ${obterNomeFila(filaKey)}.`);
        return;
      }
      removerVeiculoDasFilas(prefixo);
      if (!colocarVeiculoNaFila(prefixo, filaKey)) {
        mostrarErroLancamento(`Sem vaga livre em ${obterNomeFila(filaKey)}.`);
        return;
      }
      if (ehFilaBloqueada(filaKey)) {
        patio.pedidos = patio.pedidos.filter((p) => p != prefixo);
      }
      salvarUltimaFila(filaKey);
      salvarEstado();
      renderizarPatio();
      mostrarOkLancamento(mensagemOk || `✓ ${prefixo} lançado em ${obterNomeFila(filaKey)}.`);
      if (input) {
        input.value = "";
        input.focus();
      }
    } finally {
      lancamentoEmAndamento = false;
    }
  }

  function alocarNaFila() {
    if (lancamentoEmAndamento) return;
    const input = document.getElementById("inputFilaBus");
    const select = document.getElementById("selectFila");
    const prefixo = normalizarPrefixoInput(input);
    const filaKey = select?.value;

    limparFeedbackLancamento();

    if (!prefixo) {
      mostrarErroLancamento("Digite o prefixo do veículo.");
      input?.focus();
      return;
    }
    if (!veiculoExisteNaFrota(prefixo)) {
      mostrarErroLancamento(`Veículo ${prefixo} não existe na frota.`);
      input?.select();
      return;
    }
    if (!filaKey) {
      mostrarErroLancamento("Selecione a fila de destino.");
      return;
    }

    const loc = localizarVeiculo(prefixo);
    if (loc) {
      const origem = obterNomeFila(loc.filaKey);
      const destino = obterNomeFila(filaKey);
      if (loc.filaKey === filaKey) {
        mostrarErroLancamento(`Veículo ${prefixo} já está em ${destino}.`);
        input?.select();
        return;
      }
      const mover = confirm(
        `Veículo ${prefixo} já está em ${origem}.\n\nDeseja mover para ${destino}?`
      );
      if (!mover) {
        mostrarErroLancamento(`Lançamento cancelado. ${prefixo} permanece em ${origem}.`);
        input?.select();
        return;
      }
      aplicarAlocacao(prefixo, filaKey, input, `✓ ${prefixo} movido de ${origem} para ${destino}.`);
      return;
    }

    aplicarAlocacao(prefixo, filaKey, input);
  }

  function togglePedido(prefixo) {
    if (!prefixo) return;
    const loc = localizarVeiculo(prefixo);
    if (loc && ehFilaBloqueada(loc.filaKey)) return;
    if (patio.pedidos.includes(prefixo)) {
      patio.pedidos = patio.pedidos.filter((p) => p != prefixo);
    } else {
      patio.pedidos.push(prefixo);
    }
    salvarEstado();
    if (loc) sincronizarInputGabarito(loc.filaKey, loc.posicao);
    renderizarListaNaoUtilizados();
    atualizarResumo();
  }

  function marcarPedido() {
    if (pedidoEmAndamento) return;
    const input = document.getElementById("pedidosBus");
    const prefixo = normalizarPrefixoInput(input);
    limparFeedbackPedido();

    const val = validarPedido(prefixo);
    if (!val.ok) {
      mostrarErroPedido(val.msg);
      input?.select();
      return;
    }

    pedidoEmAndamento = true;
    try {
      patio.pedidos.push(prefixo);
      salvarEstado();
      sincronizarInputGabarito(val.loc.filaKey, val.loc.posicao);
      renderizarListaNaoUtilizados();
      atualizarResumo();
      mostrarOkPedido(`✓ ${prefixo} marcado como Pedido.`);
      if (input) {
        input.value = "";
        input.focus();
      }
    } finally {
      pedidoEmAndamento = false;
    }
  }

  function configurarAtalhosLancamento() {
    document.querySelectorAll("[data-atalho-fila]").forEach((btn) => {
      btn.addEventListener("click", () => {
        definirFilaSelecionada(btn.dataset.atalhoFila);
        limparFeedbackLancamento();
        document.getElementById("inputFilaBus")?.focus();
      });
    });
  }

  function liberarCarro(prefixo) {
    const loc = localizarVeiculo(prefixo);
    removerVeiculoDeTudo(prefixo);
    salvarEstado();
    if (loc) sincronizarInputGabarito(loc.filaKey, loc.posicao);
    renderizarListaNaoUtilizados();
    atualizarResumo();
    if (modoVisualizacaoMapa === "zonas") renderizarMapa();
  }

  function limparTudo() {
    if (!confirm("Redefinir todo o pátio, pedidos e histórico de utilizados?")) return;
    patio = {
      versao: 4,
      filas: criarFilasVazias(),
      bloqueioVagas: criarBloqueioPadrao(),
      analisados: [],
      pedidos: []
    };
    salvarEstado();
    renderizarPatio();
    focarPrimeiraCelulaGabarito();
    const resultBox = document.getElementById("resultOutput");
    if (resultBox) {
      resultBox.className = "result-box";
      resultBox.innerHTML = "";
    }
    document.getElementById("inputFilaBus")?.focus();
  }

  function focarPrimeiraCelulaGabarito() {
    const input = document.querySelector(".gab-cel-input");
    if (input) {
      input.focus();
      input.select();
    }
  }

  function consultarFila() {
    const input = document.getElementById("searchBus");
    const resultBox = document.getElementById("resultOutput");
    const prefixo = normalizarPrefixoInput(input);

    if (!prefixo) {
      resultBox.className = "result-box";
      resultBox.innerHTML = "";
      return;
    }

    if (!veiculoExisteNaFrota(prefixo)) {
      resultBox.className = "result-box warning";
      resultBox.innerHTML = `Veículo <b>${prefixo}</b> não está na frota.`;
      input?.select();
      return;
    }

    const loc = localizarVeiculo(prefixo);
    if (!loc) {
      resultBox.className = "result-box";
      resultBox.innerHTML = `<b>${prefixo}</b> — sem alocação no pátio.`;
      input.value = "";
      return;
    }

    const nome = obterNomeFila(loc.filaKey);
    const tags = [];
    if (patio.pedidos.includes(prefixo)) tags.push("Pedido");
    if (ehFilaBloqueada(loc.filaKey)) tags.push("Bloqueado");
    const tagsTxt = tags.length ? ` <span style="opacity:.85">(${tags.join(" · ")})</span>` : "";

    resultBox.className = "result-box success";
    resultBox.innerHTML = `<b>${prefixo}</b> está em <b>${nome}</b>.${tagsTxt}`;
    input.value = "";
    input.focus();
  }

  function formatarValorExportCarro(prefixo) {
    const p = String(prefixo);
    const tags = [];
    if (patio.pedidos.includes(p)) tags.push("PEDIDO");
    if (tags.length) return `${p} [${tags.join(" · ")}]`;
    return p;
  }

  function valorCelulaExportGabarito(cel) {
    if (cel.tipo === "vaga" && cel.filaKey && cel.slotIndex >= 0) {
      if (ehVagaBloqueada(cel.filaKey, cel.slotIndex)) return "X";
      const prefixo = patio.filas[cel.filaKey]?.[cel.slotIndex];
      if (prefixo) return formatarValorExportCarro(prefixo);
      return cel.rotulo || cel.text || "";
    }
    if (cel.tipo === "lista" && cel.filaKey) {
      const carros = (patio.filas[cel.filaKey] || []).filter((p) => p != null && String(p).trim());
      if (carros.length) return carros.map((p) => formatarValorExportCarro(p)).join(", ");
      return cel.text || "";
    }
    if (cel.tipo === "faixa") return "";
    return cel.text || "";
  }

  function corFundoExportGabarito(cel, valor) {
    if (cel.tipo === "vaga" && cel.filaKey && cel.slotIndex >= 0) {
      if (ehVagaBloqueada(cel.filaKey, cel.slotIndex)) return "#FEF2F2";
      const prefixo = patio.filas[cel.filaKey]?.[cel.slotIndex];
      if (prefixo && patio.pedidos.includes(String(prefixo))) return "#0B3A8A";
    }
    return cel.bg || "#FFFFFF";
  }

  function hexArgbExport(hex) {
    if (!hex || !String(hex).startsWith("#")) return undefined;
    return (`FF${String(hex).slice(1)}`).toUpperCase();
  }

  function prefixoDoValorExport(valor) {
    const m = String(valor || "").match(/^(\d+)/);
    return m ? m[1] : "";
  }

  function estiloCelulaExportGabarito(cel, valor) {
    const bg = corFundoExportGabarito(cel, valor);
    const prefixo = prefixoDoValorExport(valor);
    const cor = prefixo && patio.pedidos.includes(prefixo)
      ? "#FFFFFF"
      : (cel.cor || "#1F2937");
    const estilo = {
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      font: {
        sz: cel.tipo === "via" ? 10 : 9,
        bold: cel.tipo === "via" || cel.tipo === "rotulo",
        color: hexArgbExport(cor) ? { rgb: hexArgbExport(cor) } : undefined
      },
      fill: hexArgbExport(bg) ? { patternType: "solid", fgColor: { rgb: hexArgbExport(bg) } } : undefined
    };
    return estilo;
  }

  function exportarExcelTabela() {
    const headers = TODAS_FILAS.map((f) => obterNomeFila(f.key).toUpperCase());
    const maxLinhas = Math.max(
      ...TODAS_FILAS.map((f) => {
        const cap = obterCapacidadeFila(f.key);
        return cap || (patio.filas[f.key] || []).length;
      }),
      0
    );
    const dadosExcel = [
      ["GERENCIAMENTO DO PÁTIO — CIOP / TCGL"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Frota", frotaDados.length],
      [],
      headers
    ];

    for (let i = 0; i < maxLinhas; i += 1) {
      dadosExcel.push(
        TODAS_FILAS.map((f) => {
          const p = patio.filas[f.key]?.[i];
          if (!p) return ehVagaBloqueada(f.key, i) ? "[VAGA BLOQUEADA]" : "";
          let tag = "";
          if (ehFilaBloqueada(f.key)) tag = ` [BLOQUEADO — ${f.label.toUpperCase()}]`;
          else if (patio.pedidos.includes(p)) tag = " [PEDIDO]";
          return `${p} — ${obterTecnologia(p)}${tag}`;
        })
      );
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dadosExcel);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, "Patio");
    XLSX.writeFile(wb, "Gabarito_Patio_CIOP_TCGL.xlsx");
  }

  function exportarExcel() {
    const grade = window.GABARITO_GARAGEM?.gradeCompleta;
    if (!grade?.linhas?.length) {
      exportarExcelTabela();
      return;
    }

    const ws = {};
    const merges = [];
    let maxR = 0;
    const maxC = (grade.colWidths?.length || grade.cols || 1) - 1;

    grade.linhas.forEach((linha) => {
      maxR = Math.max(maxR, linha.r);
      linha.celulas.forEach((cel) => {
        const valor = valorCelulaExportGabarito(cel);
        const ref = XLSX.utils.encode_cell({ r: linha.r, c: cel.c });
        ws[ref] = {
          v: valor,
          t: "s",
          s: estiloCelulaExportGabarito(cel, valor)
        };
        const rowSpan = cel.rowSpan || 1;
        const colSpan = cel.colSpan || 1;
        if (rowSpan > 1 || colSpan > 1) {
          merges.push({
            s: { r: linha.r, c: cel.c },
            e: { r: linha.r + rowSpan - 1, c: cel.c + colSpan - 1 }
          });
        }
      });
    });

    ws["!ref"] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: maxR, c: maxC });
    ws["!merges"] = merges;
    if (grade.colWidths?.length) {
      ws["!cols"] = grade.colWidths.map((w) => ({ wpx: w }));
    }
    ws["!rows"] = grade.linhas.map((linha) => ({ hpt: Math.max(12, Math.round((linha.h || 40) * 0.72)) }));

    const info = XLSX.utils.aoa_to_sheet([
      ["Gabarito da Garagem — CIOP / TCGL"],
      ["Gerado em", new Date().toLocaleString("pt-BR")],
      ["Fonte", window.GABARITO_GARAGEM?.source || "Gabarito Garagem.xlsx"],
      ["Veículos alocados", totalAlocados()],
      ["Pedidos", patio.pedidos.length]
    ]);
    info["!cols"] = [{ wch: 22 }, { wch: 36 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gabarito");
    XLSX.utils.book_append_sheet(wb, info, "Info");

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Gabarito_Garagem_${stamp}.xlsx`, { cellStyles: true });
    mostrarStatusGabarito("Excel do gabarito completo gerado.");
  }

  function configurarInputs() {
    const inputFila = document.getElementById("inputFilaBus");

    document.getElementById("selectFila")?.addEventListener("change", (e) => {
      salvarUltimaFila(e.target.value);
      limparFeedbackLancamento();
    });

    inputFila?.addEventListener("input", () => {
      normalizarPrefixoInput(inputFila);
      limparFeedbackLancamento();
    });

    inputFila?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      alocarNaFila();
    });
    const inputPedido = document.getElementById("pedidosBus");
    inputPedido?.addEventListener("input", () => {
      normalizarPrefixoInput(inputPedido);
      limparFeedbackPedido();
    });
    inputPedido?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      marcarPedido();
    });

    const searchBus = document.getElementById("searchBus");
    const resultBox = document.getElementById("resultOutput");
    if (searchBus) {
      searchBus.addEventListener("input", () => {
        normalizarPrefixoInput(searchBus);
        if (!searchBus.value.trim()) {
          resultBox.className = "result-box";
          resultBox.innerHTML = "";
        }
      });
      searchBus.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        consultarFila();
      });
    }

    document.getElementById("btnViewGabarito")?.addEventListener("click", () => {
      definirModoVisualizacaoMapa("gabarito");
    });
    document.getElementById("btnViewZonas")?.addEventListener("click", () => {
      definirModoVisualizacaoMapa("zonas");
    });
  }

  function inicializar() {
    popularSelectFila();
    configurarInputs();
    configurarAtalhosLancamento();
    definirModoVisualizacaoMapa(modoVisualizacaoMapa);
    popularSelectFila();
    popularDatalist();
    atualizarResumo();
    renderizarListaNaoUtilizados();
    focarPrimeiraCelulaGabarito();
    if (window.portalLoading) window.portalLoading.hide();
  }

  window.alocarNaFila = alocarNaFila;
  window.marcarPedido = marcarPedido;
  window.liberarCarro = liberarCarro;
  window.limparTudo = limparTudo;
  window.exportarExcel = exportarExcel;
  window.togglePedido = togglePedido;

  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.portalAguardarUsuario === "function") {
      window.portalAguardarUsuario(inicializar);
    } else {
      inicializar();
    }
  });
})();
