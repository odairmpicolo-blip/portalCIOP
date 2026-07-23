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
    out[col] = agregarValoresColuna(col, linhas.map((r) => r[col]));
  });
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
  // Planilha TCGL usa a coluna "Km" para o km percorrido no dia — sem este alias,
  // o valor nunca era reconhecido como "Km Percorrido" e a comparação TCGL ficava vazia.
  "km": "Km Percorrido"
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
  const clever = MAP_COLUNAS_EN_PT[chave];
  if (clever) return clever;
  return original;
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
