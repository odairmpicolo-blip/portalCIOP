import { LIBERACAO_API_URL } from "./liberacao-dados-leitura.js";

/** Web App standalone — escalação / saída de carros (projeto separado da liberação). */
export const ESCALA_SAIDA_API_URL =
  "https://script.google.com/macros/s/AKfycbzhuM5h2MzGXnfHb4WmLZb3ZOrmXpGKOdtT0fiCazRV0yPJ5dlcchtlLThiagLcg8P4/exec";

export const ESCALA_SAIDA_DATA_BASE = "../assets/data/escala-saida";

const VERSAO_API_MINIMA = /escala-saida-v[23]|saida-v3/;

function planilhaPareceSemCabecalho(colunas) {
  const lista = colunas || [];
  return lista.length <= 1 && lista.some((c) => {
    const t = `${c.chave || ""} ${c.rotulo || ""}`.toLowerCase();
    return t.includes("saida_de_carros") || t.includes("saída de carros") || t.includes("saida de carros");
  });
}

function apiPareceDesatualizada(json) {
  const versao = String(json?.meta?.versao || "");
  if (VERSAO_API_MINIMA.test(versao)) return false;
  if (planilhaPareceSemCabecalho(json?.colunas)) return true;
  return !versao.includes("v2") && !versao.includes("v3");
}

async function fetchJson(url, timeoutMs = 90000) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function tentarApi(baseUrl, params) {
  const url = `${baseUrl}?${new URLSearchParams(params)}`;
  const json = await fetchJson(url);
  if (!json?.ok) throw new Error(json?.erro || "Falha na API.");
  return { json, origem: params.liberacao ? "liberacao" : "escala" };
}

async function tentarJsonLocal(data) {
  const arquivo = `${ESCALA_SAIDA_DATA_BASE}/escala-${data}.json`;
  try {
    const res = await fetch(arquivo, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.ok || !Array.isArray(json.dados)) return null;
    return { json, origem: "json" };
  } catch (_) {
    return null;
  }
}

/**
 * Carrega a planilha de escalação por API (escala → liberação → JSON local).
 * @returns {{ json: object, origem: string, aviso?: string }}
 */
export async function carregarEscalaSaidaPlanilha(data) {
  const dataIso = String(data || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
    throw new Error("Data inválida.");
  }

  const tentativas = [
    () => tentarApi(ESCALA_SAIDA_API_URL, { recurso: "saida_carros", data: dataIso }),
    () => tentarApi(ESCALA_SAIDA_API_URL, { recurso: "saida_carros", data: dataIso, ignorar_data: "1" }),
    () => tentarApi(LIBERACAO_API_URL, { liberacao: "1", recurso: "saida_carros", data: dataIso }),
    () => tentarApi(LIBERACAO_API_URL, { liberacao: "1", recurso: "saida_carros", data: dataIso, ignorar_data: "1" }),
    () => tentarJsonLocal(dataIso)
  ];

  let ultimoErro = null;
  let melhorVazio = null;

  for (const tentativa of tentativas) {
    try {
      const resultado = await tentativa();
      if (!resultado) continue;
      const { json, origem } = resultado;
      const linhas = Array.isArray(json.dados) ? json.dados.length : 0;
      const desatualizada = apiPareceDesatualizada(json);

      if (linhas > 0) {
        return {
          json,
          origem,
          aviso: desatualizada
            ? "Dados carregados, mas a API parece desatualizada — reimplante o Apps Script v3."
            : undefined
        };
      }

      if (!melhorVazio) {
        melhorVazio = { json, origem, desatualizada };
      } else if (desatualizada && !melhorVazio.desatualizada) {
        melhorVazio = { json, origem, desatualizada };
      }
    } catch (err) {
      ultimoErro = err;
    }
  }

  if (melhorVazio) {
    const aviso = melhorVazio.desatualizada
      ? "API desatualizada: a 1ª linha da planilha é título, não cabeçalho. Reimplante scripts/escala-saida-carros.gs (v3) no Google Apps Script."
      : "Nenhuma linha encontrada para esta data.";
    return { json: melhorVazio.json, origem: melhorVazio.origem, aviso };
  }

  throw ultimoErro || new Error("Não foi possível carregar a planilha.");
}

export { planilhaPareceSemCabecalho, apiPareceDesatualizada };
