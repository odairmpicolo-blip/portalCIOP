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
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(n) ? NaN : n;
}

export function estrategiaColunaTelemetria(col) {
  const n = normChaveMerge(col);
  if (["cliente", "veiculo", "data", "data iso", "veiculo norm"].includes(n)) return "fixo";
  return "soma";
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
  "avg cabin temp"
]);

export const MAP_COLUNAS_EN_PT = {
  "vehicle id": "Veículo",
  "date": "Data",
  "start time local": "Inicio",
  "end time local": "Fim",
  "number of events": "Eventos",
  "start distance": "KM/Inicial",
  "end distance": "KM/Final",
  "daily distance": "Distância",
  "daily fuel consumption l": "Quant. Combustivel",
  "daily engine hours": "Cons. Combustivel",
  "daily avg km per liter": "Média Km/l",
  "avg speed": "Veloc. Média",
  "max speed": "Veloc. Máxima",
  "avg engine temp": "Temp. Méd. Motor",
  "max engine temp": "Temp. Máx. Motor",
  "avg ambient temp": "Temp. Méd. Externa",
  "avg air pressure": "Barómetro Méd.",
  "max air pressure": "Barómetro Máx.",
  "avg fuel economy": "Cons. Méd. Comb."
};

export function colunaCleverExcluida(nome) {
  return COLUNAS_EXCLUIDAS_CLEVER.has(normChaveMerge(nome));
}

export function nomeColunaClever(nome) {
  if (colunaCleverExcluida(nome)) return null;
  return MAP_COLUNAS_EN_PT[normChaveMerge(nome)] || nome;
}
