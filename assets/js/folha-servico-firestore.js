import { db } from "./portal-firestore.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const COLECAO_FOLHA_DIAS = "folhaServicoDias";
export const SUBCOLECAO_LINHAS = "linhas";

export function normalizarDataIsoRow(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(br) ? br : "";
}

function sanitizarLinha(row, dataIso) {
  const id = String(row?._row || "").trim();
  if (!id) return null;
  const copia = Object.assign({}, row);
  delete copia._dirty;
  delete copia._syncErro;
  copia._row = Number(id) || id;
  copia.data_iso = normalizarDataIsoRow(copia) || dataIso;
  if (!copia.data && dataIso) copia.data = dataIso;
  return copia;
}

export function listarDatasIsoJanela(dataDe, dataAte) {
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

function docParaLinha(item, dataIso) {
  return sanitizarLinha(Object.assign({ _row: item.id }, item.data()), dataIso);
}

export async function carregarDiaFolhaFirestore(dataIso) {
  if (!dataIso) return null;
  const diaRef = doc(db, COLECAO_FOLHA_DIAS, dataIso);
  const linhasRef = collection(diaRef, SUBCOLECAO_LINHAS);
  const [metaSnap, linhasSnap] = await Promise.all([getDoc(diaRef), getDocs(linhasRef)]);
  if (!metaSnap.exists() && linhasSnap.empty) return null;

  const dados = [];
  linhasSnap.forEach((item) => {
    const linha = docParaLinha(item, dataIso);
    if (linha) dados.push(linha);
  });
  if (!dados.length) return null;

  return {
    ok: true,
    data: dataIso,
    total: dados.length,
    dados,
    meta: metaSnap.exists() ? metaSnap.data() : {},
    origem: "firestore"
  };
}

export async function carregarJanelaFolhaFirestore(dataDe, dataAte) {
  const dias = listarDatasIsoJanela(dataDe, dataAte);
  if (!dias.length) return { dados: [], dataDe, dataAte, total: 0, diasComDados: 0 };

  const partes = await Promise.all(dias.map((dia) => carregarDiaFolhaFirestore(dia)));
  const dados = [];
  let diasComDados = 0;
  partes.forEach((parte) => {
    if (!parte?.dados?.length) return;
    diasComDados++;
    dados.push(...parte.dados);
  });

  return {
    ok: dados.length > 0,
    dados,
    dataDe,
    dataAte,
    total: dados.length,
    diasComDados,
    origem: "firestore"
  };
}

export async function salvarLinhaFolhaFirestore(row, email) {
  const dataIso = normalizarDataIsoRow(row);
  const id = String(row?._row || "").trim();
  if (!dataIso || !id) throw new Error("Linha invalida para Firestore.");
  const payload = sanitizarLinha(row, dataIso);
  if (!payload) throw new Error("Linha invalida para Firestore.");
  payload.atualizadoEm = serverTimestamp();
  payload.atualizadoPor = String(email || "").trim().toLowerCase();
  payload.origem = "portal";
  await setDoc(doc(db, COLECAO_FOLHA_DIAS, dataIso, SUBCOLECAO_LINHAS, id), payload, { merge: true });
  await setDoc(doc(db, COLECAO_FOLHA_DIAS, dataIso), {
    data: dataIso,
    atualizadoEm: serverTimestamp()
  }, { merge: true });
  return payload;
}
