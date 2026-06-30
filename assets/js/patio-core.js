/** Regras compartilhadas do pátio (leitura do localStorage patio_tcgl_v3). */
export const STORAGE_KEY = "patio_tcgl_v3";

export const HORA_MINIMA_CORUJAO = "06:00";

export const GRUPOS_PATIO = [
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

export const GRUPO_BLOQUEADOS = {
  id: "bloqueados",
  titulo: "Bloqueados",
  filas: [
    { key: "reforma", label: "Reforma", bloqueado: true },
    { key: "oficina", label: "Oficina", bloqueado: true }
  ]
};

/** Vagas bloqueadas por padrão (índice 0 = 1ª vaga). */
export const BLOQUEIO_VAGAS_PADRAO = {
  pesados_f1: [0],
  pesados_f3: Array.from({ length: 23 }, (_, i) => i),
  pesados_f4: Array.from({ length: 24 }, (_, i) => i)
};

const TODAS_FILAS = [
  ...GRUPOS_PATIO.flatMap((g) => g.filas),
  ...GRUPO_BLOQUEADOS.filas
];

export const FILA_MAP = Object.fromEntries(TODAS_FILAS.map((f) => [f.key, f]));

const GRUPO_POR_FILA = {};
GRUPOS_PATIO.forEach((g) => g.filas.forEach((f) => { GRUPO_POR_FILA[f.key] = g; }));
GRUPO_BLOQUEADOS.filas.forEach((f) => { GRUPO_POR_FILA[f.key] = GRUPO_BLOQUEADOS; });

/** Filas com saída livre — sem depender de fila anterior no grupo. */
export const FILAS_SAIDA_LIVRE = new Set([
  "latavador_f1",
  "mistos_f1",
  "pesados_f1",
  "leves_f1",
  "corredor_c1",
  "corredor_c2",
  "corredor_c3",
  "corredor_c4",
  "corredor_c5",
  "corredor_c6",
  "cot",
  "muro",
  "bomba"
]);

/** Carros em bloqueio (reforma / oficina) não entram na escalação. */
const FILAS_NAO_UTILIZAVEIS = new Set([
  "reforma",
  "oficina",
  "bloqueados_oficina"
]);

export const ORDEM_MAXIMA_FILAS_SEQUENCIAIS = 4;

export function ehFilaNaoUtilizavelEscala(filaKey) {
  return FILAS_NAO_UTILIZAVEIS.has(filaKey);
}

/** Saída livre na escalação — não depende de fila anterior no grupo. */
export function ehSaidaLivre(filaKey) {
  return FILAS_SAIDA_LIVRE.has(filaKey);
}

/** Ordem de prioridade das filas livres na escalação de saída. */
export const FILAS_LIVRE_ESCALA_ORDEM = [
  "pesados_f1",
  "mistos_f1",
  "leves_f1",
  "corredor_c1",
  "corredor_c2",
  "corredor_c3",
  "corredor_c4",
  "corredor_c5",
  "corredor_c6",
  "latavador_f1",
  "muro",
  "bomba",
  "cot"
];

/** Filas sequenciais (Fila 2 → 3 → 4) nos grupos pesados, mistos e leves. */
export const ORDENS_FILA_SEQUENCIAL_ESCALA = [2, 3, 4];

const GRUPOS_FILA_SEQUENCIAL = new Set(["pesados", "mistos", "leves"]);

export function ehFilaSequencialGrupo(filaKey) {
  const grupo = GRUPO_POR_FILA[filaKey];
  if (!grupo || !GRUPOS_FILA_SEQUENCIAL.has(grupo.id)) return false;
  return !ehSaidaLivre(filaKey);
}

export function ordemSequencialFila(filaKey) {
  return FILA_MAP[filaKey]?.ordem || 0;
}

/**
 * Ordem de escalação entre filas do mesmo grupo (1 → 2 → 3 → 4).
 * Áreas de saída livre entram sempre no bucket 1, junto com a Fila 1 sequencial.
 */
export function obterOrdemFilaSaida(filaKey) {
  if (FILAS_NAO_UTILIZAVEIS.has(filaKey)) return 99;
  const cfg = FILA_MAP[filaKey];
  if (!cfg) return 50;
  if (ehSaidaLivre(filaKey)) return 1;
  return cfg.ordem || 1;
}

export function obterCapacidadeFila(filaKey) {
  return FILA_MAP[filaKey]?.capacidade || 0;
}

export function filaUsaGradeVagas(filaKey) {
  return obterCapacidadeFila(filaKey) > 0;
}

export function criarBloqueioVagasPadrao() {
  const bloqueio = {};
  Object.entries(BLOQUEIO_VAGAS_PADRAO).forEach(([key, indices]) => {
    bloqueio[key] = [...indices];
  });
  return bloqueio;
}

function criarGradeVazia(filaKey) {
  const cap = obterCapacidadeFila(filaKey);
  return cap > 0 ? Array(cap).fill(null) : [];
}

function criarFilasVazias() {
  const filas = {};
  TODAS_FILAS.forEach((f) => { filas[f.key] = criarGradeVazia(f.key); });
  return filas;
}

function normalizarListaCarros(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.filter((p) => p != null && String(p).trim() !== "");
}

function mapChaveFilaLegado(key) {
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


function migrarEstado(raw) {
  const pedidos = Array.isArray(raw?.pedidos) ? raw.pedidos : (raw?.rpl || []);
  const analisados = Array.isArray(raw?.analisados) ? raw.analisados : [];

  if (raw?.versao === 4 && raw.filas) {
    const filas = criarFilasVazias();
    const bloqueioVagas = criarBloqueioVagasPadrao();
    Object.keys(filas).forEach((k) => {
      if (!Array.isArray(raw.filas[k])) return;
      if (filaUsaGradeVagas(k)) {
        bloqueioVagas[k] = Array.isArray(raw.bloqueioVagas?.[k])
          ? [...raw.bloqueioVagas[k]]
          : [...(BLOQUEIO_VAGAS_PADRAO[k] || [])];
        colocarCarrosNaGrade(filas, bloqueioVagas, k, normalizarListaCarros(raw.filas[k]));
      } else {
        filas[k] = normalizarListaCarros(raw.filas[k]);
      }
    });
    return { versao: 4, filas, bloqueioVagas, analisados, pedidos };
  }

  const legado = {};
  if (raw?.versao === 3 && raw.filas) {
    Object.entries(raw.filas).forEach(([k, v]) => { legado[k] = normalizarListaCarros(v); });
  } else if (raw && !raw.versao) {
    legado.muro = raw.filaMuro || [];
    legado.mistos_f1 = raw.fila1 || [];
    legado.mistos_f2 = raw.fila2 || [];
    legado.mistos_f3 = raw.fila3 || [];
    legado.mistos_f4 = raw.fila4 || [];
    legado.oficina_f1 = raw.oficina || [];
  }

  const filas = criarFilasVazias();
  const bloqueioVagas = criarBloqueioVagasPadrao();
  const acumulado = {};

  Object.entries(legado).forEach(([key, lista]) => {
    const dest = mapChaveFilaLegado(key);
    if (!acumulado[dest]) acumulado[dest] = [];
    acumulado[dest].push(...lista);
  });

  Object.entries(acumulado).forEach(([filaKey, carros]) => {
    if (!filas[filaKey]) return;
    colocarCarrosNaGrade(filas, bloqueioVagas, filaKey, carros);
  });

  return { versao: 4, filas, bloqueioVagas, analisados, pedidos };
}

export function obterBloqueioVagas(patio, filaKey) {
  return patio.bloqueioVagas?.[filaKey] || BLOQUEIO_VAGAS_PADRAO[filaKey] || [];
}

export function ehVagaBloqueada(patio, filaKey, indice) {
  return obterBloqueioVagas(patio, filaKey).includes(indice);
}

export function iterarCarrosNaFila(patio, filaKey) {
  const lista = patio.filas?.[filaKey] || [];
  const resultado = [];
  lista.forEach((item, indice) => {
    if (item == null || String(item).trim() === "") return;
    resultado.push({ prefixo: String(item), indice });
  });
  return resultado;
}

export function contarCarrosNaFila(patio, filaKey) {
  return iterarCarrosNaFila(patio, filaKey).length;
}

export function carregarPatio() {
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")
    || JSON.parse(localStorage.getItem("patio_tcgl_v2") || "null");
  return migrarEstado(raw);
}

/** Cópia mutável do pátio para simular saídas durante a escalação. */
export function clonarPatio(patio) {
  const bloqueioBase = patio.bloqueioVagas || criarBloqueioVagasPadrao();
  return {
    ...patio,
    versao: 4,
    filas: Object.fromEntries(
      Object.entries(patio.filas).map(([key, lista]) => [key, [...lista]])
    ),
    bloqueioVagas: Object.fromEntries(
      Object.entries(bloqueioBase).map(([key, lista]) => [key, [...lista]])
    ),
    pedidos: [...(patio.pedidos || [])],
    analisados: [...(patio.analisados || [])]
  };
}

/** Remove veículo das filas após alocado para saída (simulação 1 a 1). */
export function registrarSaidaVeiculo(prefixo, patio) {
  const alvo = String(prefixo || "").trim();
  if (!alvo) return;
  Object.keys(patio.filas).forEach((key) => {
    if (filaUsaGradeVagas(key)) {
      patio.filas[key] = patio.filas[key].map((p) => (String(p) === alvo ? null : p));
    } else {
      patio.filas[key] = patio.filas[key].filter((p) => String(p) !== alvo);
    }
  });
}

export function localizarVeiculo(prefixo, patio) {
  const alvo = String(prefixo || "").trim();
  if (!alvo) return null;
  for (const [key, lista] of Object.entries(patio.filas)) {
    const idx = lista.findIndex((p) => p != null && String(p) === alvo);
    if (idx !== -1) return { filaKey: key, posicao: idx };
  }
  return null;
}

export function obterNomeFila(key) {
  const fila = FILA_MAP[key];
  if (!fila) return key;
  const grupo = GRUPO_POR_FILA[key];
  return grupo ? `${grupo.titulo} · ${fila.label}` : fila.label;
}

export function formatarPosicaoPatio(loc) {
  if (!loc) return "";
  return obterNomeFila(loc.filaKey);
}

export function normalizarTecnologia(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function obterTecnologia(prefixo, frota) {
  const item = obterItemFrota(prefixo, frota);
  if (!item) return "";
  if (item.rotulo) return item.rotulo;
  return formatarRotuloFrota(item);
}

export function obterItemFrota(prefixo, frota) {
  const alvo = String(prefixo || "").trim();
  return (frota || []).find((f) => String(f.veiculo) === alvo) || null;
}

export function formatarRotuloFrota(item) {
  if (!item) return "";
  if (item.rotulo) return item.rotulo;
  const partes = [item.cor, item.tecnologia, item.climatizacao].filter(Boolean);
  return partes.join(" · ");
}

export function obterClimatizacao(prefixo, frota) {
  const item = obterItemFrota(prefixo, frota);
  return item?.climatizacao || "";
}

export function obterTipoTecnologia(prefixo, frota) {
  const item = obterItemFrota(prefixo, frota);
  if (item?.tecnologia) return normalizarTecnologia(item.tecnologia);
  return extrairTipoDeRotulo(obterTecnologia(prefixo, frota));
}

const CORES_VEICULO = ["amarelo", "azul", "verde", "vermelho", "branco", "laranja", "roxo"];

function extrairTipoDeRotulo(rotulo) {
  const norm = normalizarTecnologia(rotulo);
  let corpo = norm;
  for (const cor of CORES_VEICULO) {
    if (corpo.startsWith(`${cor} `)) {
      corpo = corpo.slice(cor.length + 1).trim();
      break;
    }
  }
  corpo = corpo.replace(/\s*com\s*ar\s*/g, "").trim();
  return corpo;
}

export function obterCor(prefixo, frota) {
  const item = obterItemFrota(prefixo, frota);
  if (item?.cor) return normalizarTecnologia(item.cor);
  const tech = normalizarTecnologia(item?.rotulo || obterTecnologia(prefixo, frota));
  for (const cor of CORES_VEICULO) {
    if (tech.startsWith(`${cor} `) || tech === cor) return cor;
  }
  return "";
}

export function obterPerfilTecnologia(prefixo, frota) {
  const item = obterItemFrota(prefixo, frota);
  const rotulo = item ? formatarRotuloFrota(item) : obterTecnologia(prefixo, frota);
  const cor = obterCor(prefixo, frota);
  const tipo = item?.tecnologia
    ? normalizarTecnologia(item.tecnologia)
    : extrairTipoDeRotulo(rotulo);
  const climatizacao = item?.climatizacao || "";
  const completo = cor && tipo ? `${cor} ${tipo}` : tipo || cor;
  return { cor, resto: tipo, tecnologia: tipo, climatizacao, completo, rotulo };
}

export function mesmaCorVeiculo(prefixoA, prefixoB, frota) {
  const a = obterCor(prefixoA, frota);
  const b = obterCor(prefixoB, frota);
  if (!a && !b) return true;
  return Boolean(a && b && a === b);
}

export function ehPedido(prefixo, patio) {
  return patio.pedidos.includes(String(prefixo || "").trim());
}

function horaAtualMinutos() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function horaTextoParaMinutos(hora) {
  const [h, m] = String(hora || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
}

export function corujaoDisponivel(agora = horaAtualMinutos()) {
  return agora >= horaTextoParaMinutos(HORA_MINIMA_CORUJAO);
}

/** Rótulo de ordem de saída conforme legenda do Gabarito (linha 14: LIVRE · 2º · 3º · 4º). */
export function obterRotuloOrdemSaida(filaKey) {
  const cfg = FILA_MAP[filaKey];
  if (!cfg || FILAS_NAO_UTILIZAVEIS.has(filaKey)) return "";
  if (cfg.horarioMinimo) return "LIVRE";
  if (ehSaidaLivre(filaKey)) return "LIVRE";
  const ordem = cfg.ordem || 0;
  if (ordem === 2) return "2º";
  if (ordem === 3) return "3º";
  if (ordem === 4) return "4º";
  if (ordem >= 5) return `${ordem}º`;
  return "";
}

/** Filas anteriores no mesmo grupo que ainda têm carros (Fila 1 → 2 → 3 → 4). */
function filasAnterioresBloqueando(patio, filaKey) {
  const filaCfg = FILA_MAP[filaKey];
  const grupo = GRUPO_POR_FILA[filaKey];
  if (!filaCfg || !grupo || ehSaidaLivre(filaKey)) return [];
  if (!filaCfg.ordem || filaCfg.ordem <= 1) return [];

  return grupo.filas.filter(
    (f) => f.ordem < filaCfg.ordem && contarCarrosNaFila(patio, f.key) > 0
  );
}

/** Verifica se o veículo pode sair do pátio conforme fila (ordem entre filas, não posição no array). */
export function avaliarSaidaVeiculo(prefixo, patio, opcoes = {}) {
  const alvo = String(prefixo || "").trim();
  if (!alvo) {
    return { ok: false, motivo: "Sem prefixo informado." };
  }

  const loc = localizarVeiculo(alvo, patio);
  if (!loc) {
    return { ok: false, motivo: "Veículo não está no pátio." };
  }

  if (FILAS_NAO_UTILIZAVEIS.has(loc.filaKey)) {
    return { ok: false, motivo: "Carro bloqueado — não utilizável.", loc };
  }

  const filaCfg = FILA_MAP[loc.filaKey];
  const horaRef = opcoes.horaReferenciaMinutos;
  const agora = horaRef != null ? horaRef : horaAtualMinutos();
  if (filaCfg?.horarioMinimo && !corujaoDisponivel(agora)) {
    return {
      ok: false,
      motivo: `Corujão: escalar somente após ${filaCfg.horarioMinimo}.`,
      loc
    };
  }

  if (ehSaidaLivre(loc.filaKey)) {
    return { ok: true, loc };
  }

  const bloqueadas = filasAnterioresBloqueando(patio, loc.filaKey);
  if (bloqueadas.length) {
    const nomes = bloqueadas
      .map((f) => `${f.label} (${contarCarrosNaFila(patio, f.key)})`)
      .join(", ");
    return { ok: false, motivo: `Saída bloqueada — filas anteriores com veículos: ${nomes}.`, loc };
  }

  return { ok: true, loc };
}

/** Situação do veículo no pátio (mesma lógica da Consulta de fila do gerenciapatio). */
export function consultarSituacaoCarro(prefixo, patio, opcoes = {}) {
  const alvo = String(prefixo || "").trim();
  if (!alvo) return { tipo: "vazio" };

  const loc = localizarVeiculo(alvo, patio);
  if (!loc) {
    return { tipo: "ausente", prefixo: alvo, motivo: "Sem alocação no pátio." };
  }

  const fila = obterNomeFila(loc.filaKey);
  const tags = [];
  if (ehPedido(alvo, patio)) tags.push("Pedido");
  if (FILAS_NAO_UTILIZAVEIS.has(loc.filaKey)) tags.push("Bloqueado");

  if (ehPedido(alvo, patio)) {
    return {
      tipo: "indisponivel",
      prefixo: alvo,
      loc,
      fila,
      motivo: "Carro pedido — buscar substituto.",
      tags
    };
  }

  const saida = avaliarSaidaVeiculo(alvo, patio, opcoes);
  if (saida.ok) {
    return { tipo: "livre", prefixo: alvo, loc: saida.loc, fila, tags };
  }

  return {
    tipo: "indisponivel",
    prefixo: alvo,
    loc,
    fila,
    motivo: saida.motivo,
    tags
  };
}

export function formatarConsultaFila(situacao) {
  if (!situacao || situacao.tipo === "vazio") return "";
  if (situacao.tipo === "ausente") {
    return `${situacao.prefixo} — sem alocação no pátio.`;
  }
  const tagsTxt = situacao.tags?.length ? ` (${situacao.tags.join(" · ")})` : "";
  return `${situacao.prefixo} · ${situacao.fila}${tagsTxt}`;
}

export function listarCandidatosSubstituto(tecnologia, patio, frota, opcoes = {}) {
  const techAlvo = normalizarTecnologia(tecnologia);
  const incluirOutras = opcoes.incluirOutrasTecnologias === true;
  if (!techAlvo && !incluirOutras) return [];

  const usados = opcoes.usados || new Set();
  const excluir = new Set((opcoes.excluir || []).map(String));
  const filtroCarro = opcoes.filtroCarro;
  const candidatos = [];

  const ordemMax = opcoes.ordemMax;
  const optsSaida = opcoes.horaReferenciaMinutos != null
    ? { horaReferenciaMinutos: opcoes.horaReferenciaMinutos }
    : {};

  Object.entries(patio.filas).forEach(([filaKey, lista]) => {
    if (FILAS_NAO_UTILIZAVEIS.has(filaKey)) return;
    if (typeof opcoes.filtroFilaKey === "function" && !opcoes.filtroFilaKey(filaKey)) return;

    iterarCarrosNaFila(patio, filaKey).forEach(({ prefixo, indice }) => {
      const p = String(prefixo);
      if (excluir.has(p) || usados.has(p)) return;
      if (opcoes.excluirPedidos && ehPedido(p, patio)) return;

      const perfilCarro = obterPerfilTecnologia(p, frota);
      const chaveCarro = perfilCarro.completo || perfilCarro.resto;
      const mesmaTecnologia = Boolean(techAlvo && chaveCarro === techAlvo);
      if (techAlvo && !mesmaTecnologia && !incluirOutras) return;

      const saida = avaliarSaidaVeiculo(p, patio, optsSaida);
      if (!saida.ok) return;
      if (typeof opcoes.filtroPrefixo === "function" && !opcoes.filtroPrefixo(p, saida.loc)) return;
      if (typeof filtroCarro === "function" && !filtroCarro(p, saida.loc)) return;

      const ordemFila = obterOrdemFilaSaida(filaKey);
      if (opcoes.ordemFilaAlvo != null && ordemFila !== opcoes.ordemFilaAlvo) return;
      if (ordemMax != null && ordemFila > ordemMax) return;

      candidatos.push({
        prefixo: p,
        loc: { ...saida.loc, posicao: indice },
        ordemFila,
        mesmaTecnologia: mesmaTecnologia ? 1 : 0
      });
    });
  });

  candidatos.sort((a, b) => {
    if (b.mesmaTecnologia !== a.mesmaTecnologia) return b.mesmaTecnologia - a.mesmaTecnologia;
    if (a.ordemFila !== b.ordemFila) return a.ordemFila - b.ordemFila;
    return Number(a.prefixo) - Number(b.prefixo);
  });

  return candidatos;
}
