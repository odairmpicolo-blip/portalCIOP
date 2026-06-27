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

export async function enviarLinhaPlanilha(payload) {
  const body = new URLSearchParams({ liberacao: "1", ...payload });
  const res = await fetch(config.liberacaoApiUrl, {
    method: "POST",
    body,
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    throw new Error("Resposta inválida da planilha ao salvar");
  }
  if (!data.ok) throw new Error(data.erro || "Erro ao salvar na planilha");
  return data;
}

export { listarDatasIso };
