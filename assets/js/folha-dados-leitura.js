import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from "./portal-firestore.js";
import {
  carregarDiaFolhaFirestore,
  carregarJanelaFolhaFirestore,
  listarDatasIsoJanela,
  normalizarDataIsoRow
} from "./folha-servico-firestore.js";

export { normalizarDataIsoRow };

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

/** Interseção do período pedido com a janela recente (planilha é fonte viva). */
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

async function aguardarAuthFirestore() {
  const auth = getAuth(app);
  if (typeof auth.authStateReady === "function") await auth.authStateReady();
  return auth.currentUser;
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

async function carregarDadosFirestore(dataDe, dataAte) {
  await aguardarAuthFirestore();
  const dias = listarDatasIsoJanela(dataDe, dataAte);
  const partes = await Promise.all(
    dias.map((dia) => carregarDiaFolhaFirestore(dia).catch(() => null))
  );
  let dados = [];
  partes.forEach((parte) => {
    if (parte?.dados?.length) dados.push(...parte.dados);
  });
  if (!dados.length) {
    const janela = await carregarJanelaFolhaFirestore(dataDe, dataAte).catch(() => null);
    if (janela?.dados?.length) dados = janela.dados;
  }
  return filtrarPeriodo(dados, dataDe, dataAte);
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

/** Carrega registros de um período (Firestore → JSON → planilha). */
export async function carregarDadosFolhaPeriodo(dataDe, dataAte, { onProgress } = {}) {
  onProgress?.("Consultando Firestore e JSON...");
  const [fsRes, jsonRes] = await Promise.allSettled([
    withTimeout(carregarDadosFirestore(dataDe, dataAte), 25000),
    withTimeout(carregarJsonTodos(dataDe, dataAte), 20000)
  ]);

  const firestore = fsRes.status === "fulfilled" ? fsRes.value : [];
  const json = jsonRes.status === "fulfilled" ? jsonRes.value : [];
  const tentativas = [
    `Firestore: ${firestore.length}`,
    `JSON: ${json.length}`
  ];

  let dados = mesclarLinhas([json, firestore]);
  const origens = [];
  if (firestore.length) origens.push("Firestore");
  if (json.length) origens.push("JSON");

  const janelaPlanilha = janelaPlanilhaRecente(dataDe, dataAte);
  const buscarPlanilha = !dados.length || janelaPlanilha;
  if (buscarPlanilha) {
    const alvo = janelaPlanilha || { de: dataDe, ate: dataAte };
    onProgress?.("Complementando com planilha...");
    try {
      const planilha = await withTimeout(carregarDadosApi(alvo.de, alvo.ate), 120000);
      tentativas.push(`planilha: ${planilha.length}`);
      if (planilha.length) {
        dados = mesclarLinhas([
          dados,
          filtrarPeriodo(planilha, dataDe, dataAte)
        ]);
        origens.push("planilha");
      }
    } catch (err) {
      tentativas.push(`planilha: ${err.message === "timeout" ? "timeout" : "erro"}`);
    }
  }

  return {
    dados,
    origem: origens.join(" · ") || "",
    tentativas
  };
}

/** Complemento recente para o dashboard (Firestore prioritário). */
export async function carregarDadosFolhaFirestore(dataDe, dataAte) {
  const { dados, origem } = await carregarDadosFolhaPeriodo(dataDe, dataAte);
  return { dados, origem };
}
