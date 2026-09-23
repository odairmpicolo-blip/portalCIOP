const CHAVES = [
  "NO_HORARIO|ATRASADO",
  "NO_HORARIO|ADIANTADO",
  "ATRASADO|NO_HORARIO",
  "ATRASADO|ADIANTADO",
  "ATRASADO|ATRASADO",
  "ADIANTADO|NO_HORARIO",
  "ADIANTADO|ATRASADO",
  "ADIANTADO|ADIANTADO"
];

function val(row, key) {
  if (row?.[key] != null && row[key] !== "") return row[key];
  if (key === "saida_atrasado_adiantado") return row?.saida_atrasado_adiantado || "";
  if (key === "saiu_no_horario") return row?.saiu_no_horaro || "";
  return "";
}

function normalizarSituacao(v) {
  const t = String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (!t) return "";
  if (t.includes("ADIANT")) return "ADIANTADO";
  if (t.includes("ATRAS")) return "ATRASADO";
  if (t.includes("HOR") || t === "SIM") return "NO_HORARIO";
  return "";
}

export function mapaVazioLiberacao() {
  const mapa = {};
  CHAVES.forEach((c) => { mapa[c] = {}; });
  return mapa;
}

export function agregarLiberacao(dados) {
  const mapa = mapaVazioLiberacao();
  (dados || []).forEach((row) => {
    const s = normalizarSituacao(val(row, "saida_atrasado_adiantado")) || normalizarSituacao(val(row, "saiu_no_horario"));
    const i = normalizarSituacao(val(row, "inicio_no_horario"));
    const mot = String(val(row, "motorista")).trim();
    if (!s || !i || !mot) return;
    const chave = `${s}|${i}`;
    if (!mapa[chave]) return;
    mapa[chave][mot] = (mapa[chave][mot] || 0) + 1;
  });
  return mapa;
}

export function somarCategoriasLiberacao(listas) {
  const mapa = mapaVazioLiberacao();
  for (const cats of listas || []) {
    for (const [chave, motes] of Object.entries(cats || {})) {
      if (!mapa[chave]) mapa[chave] = {};
      for (const [mot, n] of Object.entries(motes || {})) {
        mapa[chave][mot] = (mapa[chave][mot] || 0) + Number(n || 0);
      }
    }
  }
  return mapa;
}
