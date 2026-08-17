import { db } from "./portal-firestore.js";
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const COLECAO_AUTUACOES_DIAS = "autuacoesDias";
export const SUBCOLECAO_LINHAS = "linhas";

export function normalizarDataIsoRow(row) {
  if (row?.data_iso) return row.data_iso;
  const br = String(row?.data || row?.data_br || "").trim();
  const p = br.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) return `${p[3]}-${p[1].padStart(2, "0")}-${p[2].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(br) ? br : "";
}

export function idLinhaAutuacao(row, dataIso) {
  const ordem = String(row?.ordem ?? row?.id ?? "").trim();
  if (ordem) return ordem;
  return [
    normalizarDataIsoRow(row) || dataIso || "",
    row?.notificacao || "",
    row?.auto || ""
  ].join("_").replace(/[^\w.-]+/g, "_").slice(0, 120) || "sem-id";
}

function docParaLinha(item, dataIso) {
  const data = item.data();
  return Object.assign({}, data, {
    ordem: data?.ordem ?? item.id,
    data_iso: normalizarDataIsoRow(data) || dataIso
  });
}

export async function carregarDiaAutuacoesFirestore(dataIso) {
  if (!dataIso) return null;
  const diaRef = doc(db, COLECAO_AUTUACOES_DIAS, dataIso);
  const linhasRef = collection(diaRef, SUBCOLECAO_LINHAS);
  const [metaSnap, linhasSnap] = await Promise.all([getDoc(diaRef), getDocs(linhasRef)]);
  if (!metaSnap.exists() && linhasSnap.empty) return null;

  const dados = [];
  linhasSnap.forEach((item) => {
    dados.push(docParaLinha(item, dataIso));
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

/** Carrega todo o histórico shardado por dia (somente leitura). */
export async function carregarTodosAutuacoesFirestore({ onProgress } = {}) {
  const diasSnap = await getDocs(collection(db, COLECAO_AUTUACOES_DIAS));
  if (diasSnap.empty) return { dados: [], total: 0, diasComDados: 0 };

  const dados = [];
  const docs = diasSnap.docs.sort((a, b) => a.id.localeCompare(b.id));
  const LOTE = 25;

  for (let i = 0; i < docs.length; i += LOTE) {
    onProgress?.(`Firestore: ${Math.min(i + LOTE, docs.length)}/${docs.length} dias`);
    const chunk = docs.slice(i, i + LOTE);
    const partes = await Promise.all(
      chunk.map((diaDoc) => getDocs(collection(diaDoc.ref, SUBCOLECAO_LINHAS)).catch(() => null))
    );
    partes.forEach((linhasSnap, idx) => {
      if (!linhasSnap) return;
      const dataIso = chunk[idx].id;
      linhasSnap.forEach((item) => dados.push(docParaLinha(item, dataIso)));
    });
  }

  return {
    ok: dados.length > 0,
    dados,
    total: dados.length,
    diasComDados: docs.length,
    origem: "firestore"
  };
}
