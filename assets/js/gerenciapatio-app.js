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
      norte: { titulo: "Norte", via: "Messias Wilmar de Souza", icone: "↑" },
      oeste: { titulo: "Oeste", via: "José Dias Aro", icone: "←" },
      leste: { titulo: "Leste", via: "Duque de Caxias", icone: "→" },
      sul: { titulo: "Sul", via: "Rua Tietê", icone: "↓" }
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

  function rotuloOrdemSaidaFila(filaKey, filaCfg) {
    const gab = window.GABARITO_GARAGEM?.ordemSaida?.[filaKey];
    if (gab) return gab;
    if (filaCfg.horarioMinimo || filaCfg.saidaLivre) return "LIVRE";
    const ordem = filaCfg.ordem || 0;
    if (ordem >= 2) return `${ordem}º`;
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
      ? `<span class="patio-ordem-saida patio-ordem-saida--${ordemSaida === "LIVRE" ? "livre" : "seq"}" title="Ordem de saída">${ordemSaida}</span>`
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
    mapa.querySelectorAll(".patio-fila-head, .garagem-col-head").forEach((btn) => {
      btn.addEventListener("click", () => {
        definirFilaSelecionada(btn.dataset.fila);
        document.getElementById("inputFilaBus")?.focus();
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
      mostrarErroLancamento("Remova o carro antes de bloquear a vaga.");
      return;
    }
    if (!patio.bloqueioVagas) patio.bloqueioVagas = criarBloqueioPadrao();
    const lista = new Set(patio.bloqueioVagas[filaKey] || []);
    if (lista.has(indice)) lista.delete(indice);
    else lista.add(indice);
    patio.bloqueioVagas[filaKey] = [...lista].sort((a, b) => a - b);
    salvarEstado();
    renderizarPatio();
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
    renderizarMapaProfissional();
  }

  function renderizarPatio() {
    renderizarMapa();
    popularSelectFila();
    popularDatalist();
    atualizarResumo();
    renderizarListaNaoUtilizados();
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
    renderizarPatio();
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
      renderizarPatio();
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
    removerVeiculoDeTudo(prefixo);
    salvarEstado();
    renderizarPatio();
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
    const resultBox = document.getElementById("resultOutput");
    if (resultBox) {
      resultBox.className = "result-box";
      resultBox.innerHTML = "";
    }
    document.getElementById("inputFilaBus")?.focus();
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

  function exportarExcel() {
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

    for (let i = 0; i < maxLinhas; i++) {
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
  }

  function inicializar() {
    popularSelectFila();
    configurarInputs();
    configurarAtalhosLancamento();
    renderizarPatio();
    document.getElementById("inputFilaBus")?.focus();
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
