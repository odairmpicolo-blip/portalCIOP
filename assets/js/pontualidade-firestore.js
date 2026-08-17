import { db } from "./portal-firestore.js";
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const COLECAO_PONTUALIDADE = "pontualidadeCenarios";
export const SUBCOLECAO_DIAS = "dias";

export function normalizarDataIso(row) {
  const bruto = row?.date || row?.data || row?.data_iso || "";
  const text = String(bruto).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const p = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return "";
}

function parsePercentValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  let text = String(value).trim().replace("%", "").replace(",", ".");
  const number = Number(text);
  if (!Number.isFinite(number)) return 0;
  return number > 1 ? number / 100 : number;
}

function docParaDia(item, cenario) {
  const data = item.data();
  const date = normalizarDataIso(data) || item.id;
  return {
    date,
    cenario: data?.cenario || cenario,
    no_horario: parsePercentValue(data?.no_horario),
    adiantado: parsePercentValue(data?.adiantado),
    atrasado: parsePercentValue(data?.atrasado)
  };
}

export async function carregarCenarioPontualidadeFirestore(cenario) {
  if (!cenario) return { dados: [], total: 0, origem: "firestore" };
  const cenarioRef = doc(db, COLECAO_PONTUALIDADE, cenario);
  const diasRef = collection(cenarioRef, SUBCOLECAO_DIAS);
  const [metaSnap, diasSnap] = await Promise.all([getDoc(cenarioRef), getDocs(diasRef)]);
  if (!metaSnap.exists() && diasSnap.empty) return { dados: [], total: 0, origem: "firestore" };

  const dados = [];
  diasSnap.forEach((item) => {
    const row = docParaDia(item, cenario);
    if (row.date) dados.push(row);
  });
  dados.sort((a, b) => a.date.localeCompare(b.date));

  return {
    ok: dados.length > 0,
    dados,
    total: dados.length,
    meta: metaSnap.exists() ? metaSnap.data() : {},
    origem: "firestore"
  };
}
