/**
 * Agregação telemetria Clever/TCGL — 1 linha por veículo + data, somando métricas.
 */

export function normChaveMerge(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function valorPreenchidoMerge(v) {
  const s = String(v ?? "").trim();
  if (!s) return false;
  const low = s.toLowerCase();
  return !["-", "—", "n/a", "na", "null", "undefined", "#n/a"].includes(low);
}

export function parseNumeroMerge(val) {
  const s = String(val ?? "").trim();
  if (!s) return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized = s;
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    const parts = s.split(".");
    normalized = parts.length > 2 ? parts.join("") : s;
  }
  const n = Number(normalized);
  return Number.isNaN(n) ? NaN : n;
}

export function estrategiaColunaTelemetria(col) {
  const n = normChaveMerge(col);
  if (["cliente", "veiculo", "data", "data iso", "veiculo norm"].includes(n)) return "fixo";
  if (n === "inicio" || n === "start time local") return "min";
  if (n === "fim" || n === "end time local") return "max";
  if (n.includes("horas motor")) return "fixo";
  if (n === "km inicial" || n === "start distance" || n === "hodometro inicial") return "hodometro-inicio";
  if (n === "km final" || n === "end distance" || n === "hodometro final") return "hodometro-fim";
  if (n === "km percorrido" || n === "daily distance" || n === "distancia" || n === "km") return "distancia";
  return "soma";
}

function parseDataHoraMerge(val) {
  const s = String(val ?? "").trim();
  if (!s) return NaN;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || "00"}`).getTime();
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T](\d{2}):(\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${m[4]}:${m[5]}:00`).getTime();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
}

function formatarNumeroSaida(n) {
  if (Number.isNaN(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

/* Clever e TCGL gravam hodômetro e distância em quilômetros.
   Um dia de ônibus urbano não passa de 2.000 km (24 h a 80 km/h).
   Acima disso o número é salto de contador, não distância.
   O teto de 1.000 km dos indicadores continua em dados-telemetria.js. */
export const KM_DISTANCIA_DIA_MAX = 2000;

function textoPreenchido(val) {
  return valorPreenchidoMerge(val) ? String(val).trim() : "";
}

function leituraKm(val) {
  if (!valorPreenchidoMerge(val)) return NaN;
  return parseNumeroMerge(val);
}

function distanciaConfiavel(n) {
  return Number.isFinite(n) && n >= 0 && n <= KM_DISTANCIA_DIA_MAX;
}

function campoKm(row, chaves) {
  for (const chave of chaves) {
    if (row && Object.prototype.hasOwnProperty.call(row, chave) && valorPreenchidoMerge(row[chave])) {
      return row[chave];
    }
  }
  return "";
}

function ordenarTrechos(linhas) {
  return (linhas || []).filter(Boolean).slice().sort((a, b) => {
    const ta = parseDataHoraMerge(campoKm(a, ["Inicio", "Start time local"]));
    const tb = parseDataHoraMerge(campoKm(b, ["Inicio", "Start time local"]));
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}

function motivoDistancia(n) {
  if (Number.isFinite(n) && n < 0) return "reinicio ou diferenca negativa do hodometro";
  if (Number.isFinite(n) && n > KM_DISTANCIA_DIA_MAX) return "acima do limite de distancia do dia";
  return "leitura invalida";
}

/** Distância do grupo em ordem de Início. Hodômetro não é somado.
    Diferença negativa ou acima do limite fica de fora, sem valor absoluto. */
export function resolverKmGrupo(linhas) {
  const ordenadas = ordenarTrechos(linhas);
  let inicial = "";
  let final = "";
  const distancias = [];
  const diagnostico = [];
  let tentou = false;

  ordenadas.forEach((row) => {
    const iniBruto = campoKm(row, ["Km Inicial", "start distance", "Hodômetro inicial"]);
    const fimBruto = campoKm(row, ["Km Final", "end distance", "Hodômetro final"]);
    const kmBruto = campoKm(row, ["Km Percorrido", "daily distance", "Km", "km", "Distancia", "distancia"]);
    if (!inicial && textoPreenchido(iniBruto)) inicial = textoPreenchido(iniBruto);
    if (textoPreenchido(fimBruto)) final = textoPreenchido(fimBruto);

    const informado = leituraKm(kmBruto);
    const ini = leituraKm(iniBruto);
    const fim = leituraKm(fimBruto);
    const temInformado = Number.isFinite(informado);
    const temPar = Number.isFinite(ini) && Number.isFinite(fim);
    if (!temInformado && !temPar && !textoPreenchido(kmBruto)) return;
    tentou = true;
    if (distanciaConfiavel(informado)) {
      distancias.push(informado);
      return;
    }
    const delta = temPar ? fim - ini : NaN;
    if (!temInformado && distanciaConfiavel(delta)) {
      distancias.push(delta);
      return;
    }
    const ref = temInformado ? informado : delta;
    diagnostico.push({
      percorrido: textoPreenchido(kmBruto),
      inicial: textoPreenchido(iniBruto),
      final: textoPreenchido(fimBruto),
      motivo: motivoDistancia(ref)
    });
  });

  const out = {
    inicial: inicial || null,
    final: final || null,
    percorrido: null,
    inconsistente: false,
    excluidos: diagnostico.length,
    diagnostico
  };
  if (distancias.length) {
    out.percorrido = formatarNumeroSaida(distancias.reduce((a, b) => a + b, 0));
    return out;
  }
  if (tentou && diagnostico.length) {
    out.percorrido = "";
    out.inconsistente = true;
  }
  return out;
}

function agregarValoresColuna(col, valores) {
  const preenchidos = valores.filter(valorPreenchidoMerge);
  if (!preenchidos.length) return "";

  if (estrategiaColunaTelemetria(col) === "fixo") {
    return preenchidos[preenchidos.length - 1];
  }

  const estrategia = estrategiaColunaTelemetria(col);
  if (estrategia === "min" || estrategia === "max") {
    let melhor = null;
    let melhorTs = estrategia === "min" ? Infinity : -Infinity;
    preenchidos.forEach((v) => {
      const ts = parseDataHoraMerge(v);
      if (Number.isNaN(ts)) return;
      if ((estrategia === "min" && ts < melhorTs) || (estrategia === "max" && ts > melhorTs)) {
        melhorTs = ts;
        melhor = v;
      }
    });
    if (melhor) return melhor;
    return preenchidos[preenchidos.length - 1];
  }

  const nums = preenchidos.map(parseNumeroMerge).filter((n) => !Number.isNaN(n));
  if (nums.length) {
    return formatarNumeroSaida(nums.reduce((a, b) => a + b, 0));
  }
  return preenchidos[preenchidos.length - 1];
}

export function agregarLinhasTelemetria(linhas) {
  if (!linhas?.length) return {};
  const chaves = new Set(linhas.flatMap((r) => Object.keys(r || {})));
  const out = {};
  chaves.forEach((col) => {
    if (String(col).startsWith("__")) return;
    const estrategia = estrategiaColunaTelemetria(col);
    if (estrategia === "hodometro-inicio" || estrategia === "hodometro-fim" || estrategia === "distancia") return;
    out[col] = agregarValoresColuna(col, linhas.map((r) => r[col]));
  });
  const km = resolverKmGrupo(linhas);
  if (km.inicial != null) out["Km Inicial"] = km.inicial;
  if (km.final != null) out["Km Final"] = km.final;
  if (km.percorrido != null) out["Km Percorrido"] = km.percorrido;
  if (km.inconsistente) out.__kmInconsistente = true;
  if (km.excluidos) out.__kmExcluidos = km.excluidos;
  if (km.diagnostico?.length) out.__kmDiagnostico = km.diagnostico;
  return out;
}

export function mesclarLinhasTelemetria(atual, nova) {
  return agregarLinhasTelemetria([atual, nova].filter(Boolean));
}

export const COLUNAS_EXCLUIDAS_CLEVER = new Set([
  "customer id",
  "avg cabin temp",
  "avg fuel economy"
]);

export const MAP_COLUNAS_EN_PT = {
  "vehicle id": "Veiculo",
  "date": "Data",
  "start time local": "Inicio",
  "end time local": "Fim",
  "number of events": "Registros CAN",
  "start distance": "Km Inicial",
  "end distance": "Km Final",
  "daily distance": "Km Percorrido",
  "daily fuel consumption l": "Consumo Combustivel (L)",
  "daily engine hours": "Horas Motor",
  "daily avg km per liter": "Media Km/L",
  "avg speed": "Velocidade Media",
  "max speed": "Velocidade Maxima",
  "avg engine temp": "Temperatura Motor Media",
  "max engine temp": "Temperatura Motor Maxima",
  "avg ambient temp": "Temperatura Ambiente Media",
  "avg air pressure": "Pressao Ar Media",
  "max air pressure": "Pressao Ar Maxima",
  "km": "Km Percorrido",
  "prefixo": "Veiculo",
  "hod ini": "Km Inicial",
  "hodometro inicial": "Km Inicial",
  "hodometro ini": "Km Inicial",
  "hod fin": "Km Final",
  "hodometro final": "Km Final",
  "hodometro fin": "Km Final",
  "diesel": "Consumo Combustivel (L)"
};

export function colunaCleverExcluida(nome) {
  return COLUNAS_EXCLUIDAS_CLEVER.has(normChaveMerge(nome));
}

export function nomeColunaClever(nome) {
  if (colunaCleverExcluida(nome)) return null;
  return MAP_COLUNAS_EN_PT[normChaveMerge(nome)] || null;
}

export const COLUNAS_OCULTAS_TELEMETRIA = new Set([
  "cliente",
  "customer id",
  "temperatura cabine media",
  "avg cabin temp"
]);

export function normalizarColunaTelemetria(nome) {
  const original = String(nome || "").trim();
  if (!original) return null;
  const chave = normChaveMerge(original);
  if (COLUNAS_EXCLUIDAS_CLEVER.has(chave)) return null;
  if (COLUNAS_OCULTAS_TELEMETRIA.has(chave)) return null;
  const chaveSemPonto = chave.replace(/\./g, " ").replace(/\s+/g, " ").trim();
  return MAP_COLUNAS_EN_PT[chave] || MAP_COLUNAS_EN_PT[chaveSemPonto] || original;
}

export function normalizarLinhaTelemetria(row) {
  const grupos = new Map();
  Object.entries(row || {}).forEach(([k, v]) => {
    if (k === "data_iso" || k === "veiculo_norm") {
      grupos.set(k, [v]);
      return;
    }
    const col = normalizarColunaTelemetria(k);
    if (!col) return;
    if (!grupos.has(col)) grupos.set(col, []);
    grupos.get(col).push(v);
  });
  const out = {};
  grupos.forEach((vals, col) => {
    if (col === "data_iso" || col === "veiculo_norm") {
      out[col] = vals[vals.length - 1];
      return;
    }
    out[col] = agregarValoresColuna(col, vals);
  });
  return out;
}
