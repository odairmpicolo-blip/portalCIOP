import { carregarSnapshotAws } from "./portal-aws-config.js";

export function normalizarDataIsoRow(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(br) ? br.slice(0, 10) : "";
}

export const FOLHA_API_URL = "https://script.google.com/macros/s/AKfycby9hpIGulGYxlm_Oseasi_D2GIaLSvusFNqcgrSj7l7HwxcUXLTPqd8kX1JxwkCx9lqOA/exec";
export const FOLHA_DATA_BASE = "../assets/data/folha-servico";
export const FOLHA_TODOS_URL = `${FOLHA_DATA_BASE}/todos.json`;
export const FOLHA_MANIFEST_URL = `${FOLHA_DATA_BASE}/manifest.json`;

function chaveLinha(row) {
  const id = String(row?._row || "").trim();
  if (id) return `_row:${id}`;
  return [
    normalizarDataIsoRow(row),
    row?.hora || "",
    row?.ocorrencia || "",
    row?.analista || "",
    row?.linha || ""
  ].join("|");
}

function mesclarLinhas(listas) {
  const mapa = new Map();
  listas.forEach((lista) => {
    (lista || []).forEach((row) => {
      if (!row) return;
      mapa.set(chaveLinha(row), row);
    });
  });
  return [...mapa.values()];
}

function filtrarPeriodo(dados, dataDe, dataAte) {
  return (dados || []).filter((row) => {
    const iso = normalizarDataIsoRow(row);
    return iso && iso >= dataDe && iso <= dataAte;
  });
}

const JANELA_PLANILHA_DIAS = 45;

function isoDataLocal(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function listarDatasIsoJanela(dataDe, dataAte) {
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

function janelaPlanilhaRecente(dataDe, dataAte) {
  const hoje = isoDataLocal(0);
  const limite = isoDataLocal(-JANELA_PLANILHA_DIAS);
  const de = dataDe > limite ? dataDe : limite;
  const ate = dataAte < hoje ? dataAte : hoje;
  if (ate < de) return null;
  return { de, ate };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error("timeout")), ms);
    })
  ]);
}

async function carregarJsonTodos(dataDe, dataAte) {
  try {
    const res = await fetch(`${FOLHA_TODOS_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const payload = await res.json();
    const lista = Array.isArray(payload?.dados) ? payload.dados : [];
    return filtrarPeriodo(lista, dataDe, dataAte);
  } catch (_) {
    return [];
  }
}

async function complementarPlanilha(dados, dataDe, dataAte, onProgress) {
  const tentativas = [];
  const origens = [];
  const janelaPlanilha = janelaPlanilhaRecente(dataDe, dataAte);
  const buscarPlanilha = !dados.length || janelaPlanilha;
  if (!buscarPlanilha) return { dados, origens, tentativas };

  const alvo = janelaPlanilha || { de: dataDe, ate: dataAte };
  onProgress?.("Complementando com planilha...");
  try {
    const planilha = await withTimeout(carregarDadosApi(alvo.de, alvo.ate), 120000);
    tentativas.push(`planilha: ${planilha.length}`);
    if (planilha.length) {
      dados = mesclarLinhas([dados, filtrarPeriodo(planilha, dataDe, dataAte)]);
      origens.push("planilha");
    }
  } catch (err) {
    tentativas.push(`planilha: ${err.message === "timeout" ? "timeout" : "erro"}`);
  }
  return { dados, origens, tentativas };
}

async function apiGet(params) {
  const url = `${FOLHA_API_URL}?${new URLSearchParams({ ...params, _: String(Date.now()) })}`;
  const res = await fetch(url, { cache: "no-store", redirect: "follow" });
  const texto = await res.text();
  let data;
  try {
    data = JSON.parse(texto);
  } catch (_) {
    throw new Error("Resposta inválida da planilha.");
  }
  if (!data.ok) throw new Error(data.erro || "Erro ao buscar dados.");
  return data.dados || [];
}

async function carregarDadosApi(dataDe, dataAte) {
  if (dataDe === dataAte) {
    return await apiGet({ data: dataDe });
  }
  const dias = listarDatasIsoJanela(dataDe, dataAte);
  const partes = await Promise.all(
    dias.map((dia) => apiGet({ data: dia }).catch(() => []))
  );
  return mesclarLinhas(partes);
}

async function carregarAwsPeriodo(dataDe, dataAte) {
  const snap = await carregarSnapshotAws("/snapshots/folha", { timeoutMs: 15000 });
  if (!snap?.payload) return [];
  const lista = Array.isArray(snap.payload?.dados) ? snap.payload.dados : [];
  return filtrarPeriodo(lista, dataDe, dataAte);
}

/** Carrega registros de um período (AWS → JSON → planilha). */
export async function carregarDadosFolhaPeriodo(dataDe, dataAte, { onProgress } = {}) {
  onProgress?.("Consultando AWS e JSON...");
  const [awsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarAwsPeriodo(dataDe, dataAte), 15000),
    withTimeout(carregarJsonTodos(dataDe, dataAte), 20000)
  ]);

  const aws = awsRes.status === "fulfilled" ? awsRes.value : [];
  const json = jsonRes.status === "fulfilled" ? jsonRes.value : [];
  const tentativas = [`AWS: ${aws.length}`, `JSON: ${json.length}`];
  let dados = mesclarLinhas([json, aws]);
  const origens = [];
  if (aws.length) origens.push("AWS");
  if (json.length) origens.push("JSON");

  const complemento = await complementarPlanilha(dados, dataDe, dataAte, onProgress);
  dados = complemento.dados;
  tentativas.push(...complemento.tentativas);
  complemento.origens.forEach((o) => { if (!origens.includes(o)) origens.push(o); });

  return {
    dados,
    origem: origens.join(" · ") || "",
    tentativas
  };
}
