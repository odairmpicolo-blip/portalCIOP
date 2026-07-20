import { config } from "../config.js";

const TIMEOUT_MS = Number(process.env.LIBERACAO_FETCH_TIMEOUT_MS || 120000);

function listarDatasIso(dataDe, dataAte) {
  if (!dataDe || !dataAte || dataAte < dataDe) return [];
  const out = [];
  const [y0, m0, d0] = dataDe.split("-").map(Number);
  const [y1, m1, d1] = dataAte.split("-").map(Number);
  const cursor = new Date(Date.UTC(y0, m0 - 1, d0));
  const fim = new Date(Date.UTC(y1, m1 - 1, d1));
  while (cursor <= fim) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cursor.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

async function fetchPlanilhaJson(params) {
  const url = `${config.liberacaoApiUrl}?${new URLSearchParams({
    liberacao: "1",
    ...params,
    _: String(Date.now())
  })}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow"
  });
  if (!res.ok) throw new Error(`Planilha HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.erro || "Erro na planilha");
  return data;
}

export async function buscarLiberacaoPlanilhaDia(dataIso) {
  const data = await fetchPlanilhaJson({
    recurso: "acompanhamento",
    data: dataIso,
    limit: "0",
    vivo: "1"
  });
  return data.dados || [];
}

export async function buscarLiberacaoPlanilhaPeriodo(dataDe, dataAte) {
  if (dataDe === dataAte) return buscarLiberacaoPlanilhaDia(dataDe);
  const data = await fetchPlanilhaJson({
    recurso: "acompanhamento",
    data_de: dataDe,
    data_ate: dataAte,
    ultima_semana: "0",
    vivo: "1"
  });
  return data.dados || [];
}

const CAMPOS_EDITAVEIS = [
  "carro",
  "motorista",
  "saida_real",
  "trajeto_ocioso_correto",
  "inicio_real",
  "observacoes"
];

const CAMPOS_FORMULA_PLANILHA = [
  "saiu_no_horario",
  "saiu_no_horaro",
  "saida_atrasado_adiantado",
  "minutos_atrasado_garagem",
  "minutos_adiantado_garagem",
  "inicio_no_horario",
  "minutos_atrasado_no_inicio",
  "minutos_adiantado_no_inicio"
];

export function montarPayloadUpdatePlanilha(rowId, row) {
  const payload = { action: "update", _row: String(rowId) };
  CAMPOS_EDITAVEIS.forEach((chave) => {
    payload[chave] = String(row?.[chave] ?? "");
  });
  CAMPOS_FORMULA_PLANILHA.forEach((chave) => {
    payload[chave] = String(row?.[chave] ?? "");
  });
  return payload;
}

export async function enviarLinhaPlanilha(payload) {
  // GET com query string: POST do Apps Script perde o body no redirect 302 do Google.
  const flat = { liberacao: "1", _: String(Date.now()) };
  Object.entries(payload || {}).forEach(([chave, valor]) => {
    if (valor == null) return;
    flat[chave] = String(valor);
  });
  const url = `${config.liberacaoApiUrl}?${new URLSearchParams(flat)}`;
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    const trecho = String(texto || "").replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      trecho
        ? `Resposta inválida da planilha ao salvar (${trecho})`
        : "Resposta inválida da planilha ao salvar"
    );
  }
  if (!data.ok) throw new Error(data.erro || "Erro ao salvar na planilha");
  const acaoEsperada = String(payload?.action || "").toLowerCase();
  if (acaoEsperada === "update" && data.acao && String(data.acao).toLowerCase() !== "update") {
    throw new Error("Planilha não confirmou a atualização. Reimplante o Web App no Google.");
  }
  return data;
}

export { listarDatasIso };
