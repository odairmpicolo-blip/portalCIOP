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
  return MAP_COLUNAS_EN_PT[normChaveMerge(nome)] || null;
}

export const RENOMEAR_COLUNAS_LEGADO = {
  "veiculo": "Veículo",
  "cliente": null,
  "registros can": "Eventos",
  "registro can": "Eventos",
  "km inicial": "KM/Inicial",
  "km final": "KM/Final",
  "km percorrido": "Distância",
  "consumo combustivel l": "Quant. Combustivel",
  "consumo combustivel": "Quant. Combustivel",
  "horas motor": "Cons. Combustivel",
  "media km l": "Média Km/l",
  "media km/l": "Média Km/l",
  "velocidade media": "Veloc. Média",
  "velocidade maxima": "Veloc. Máxima",
  "temperatura motor media": "Temp. Méd. Motor",
  "temperatura motor maxima": "Temp. Máx. Motor",
  "temperatura ambiente media": "Temp. Méd. Externa",
  "pressao ar media": "Barómetro Méd.",
  "pressao ar maxima": "Barómetro Máx.",
  "economia combustivel media": "Cons. Méd. Comb.",
  "temperatura cabine media": null,
  "avg cabin temp": null,
  "customer id": null
};

export function normalizarColunaTelemetria(nome) {
  const chave = normChaveMerge(nome);
  if (COLUNAS_EXCLUIDAS_CLEVER.has(chave)) return null;
  const legado = Object.prototype.hasOwnProperty.call(RENOMEAR_COLUNAS_LEGADO, chave)
    ? RENOMEAR_COLUNAS_LEGADO[chave]
    : undefined;
  if (legado === null) return null;
  if (legado) return legado;
  const clever = MAP_COLUNAS_EN_PT[chave];
  if (clever) return clever;
  const valores = new Set(Object.values(MAP_COLUNAS_EN_PT));
  if (valores.has(nome)) return nome;
  return nome;
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
