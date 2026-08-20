/**
 * Resumo mensal de km (Clever / TCGL / FleetBus) para a TV não baixar o dump de ~23 MB.
 */
import { parseNumeroMerge } from "../../backend/src/lib/telemetria-merge.js";

const FONTES = ["tcgl", "clever", "fleetbus"];
const KM_DIARIO_MAX = 1000;

function bucketVazio() {
  return { km: 0, registros: 0, veiculos: 0, dias: 0 };
}

export function agregarKmTelemetria(dados) {
  const porMes = new Map();
  const veiculosMes = new Map();
  const diasMes = new Map();
  const veiculosAno = new Map();

  function chaveMesFonte(mes, fonte) {
    return mes + "|" + fonte;
  }

  (dados || []).forEach((r) => {
    const fonte = String(r?.fonte || "").toLowerCase();
    if (!FONTES.includes(fonte)) return;
    const iso = String(r?.data_iso || "").slice(0, 10);
    if (!iso) return;
    const mes = iso.slice(0, 7);
    const ano = iso.slice(0, 4);
    if (!porMes.has(mes)) {
      const obj = {};
      FONTES.forEach((f) => { obj[f] = bucketVazio(); });
      porMes.set(mes, obj);
    }
    const b = porMes.get(mes)[fonte];
    b.registros++;
    const veic = String(r?.veiculo || r?.payload?.veiculo_norm || "").trim();
    if (veic) {
      const vk = chaveMesFonte(mes, fonte);
      if (!veiculosMes.has(vk)) veiculosMes.set(vk, new Set());
      veiculosMes.get(vk).add(veic);
      const ak = ano + "|" + fonte;
      if (!veiculosAno.has(ak)) veiculosAno.set(ak, new Set());
      veiculosAno.get(ak).add(veic);
    }
    const dk = chaveMesFonte(mes, fonte);
    if (!diasMes.has(dk)) diasMes.set(dk, new Set());
    diasMes.get(dk).add(iso);
    const km = parseNumeroMerge(r?.payload?.["Km Percorrido"]);
    if (Number.isFinite(km) && km > 0 && km <= KM_DIARIO_MAX) b.km += km;
  });

  const kmPorMes = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([mes, fontes]) => {
    const row = { mes };
    FONTES.forEach((f) => {
      const b = fontes[f];
      row[f] = {
        km: Math.round(b.km * 10) / 10,
        registros: b.registros,
        veiculos: veiculosMes.get(chaveMesFonte(mes, f))?.size || 0,
        dias: diasMes.get(chaveMesFonte(mes, f))?.size || 0
      };
    });
    return row;
  });

  const kmAno = {};
  kmPorMes.forEach((row) => {
    const ano = row.mes.slice(0, 4);
    if (!kmAno[ano]) {
      kmAno[ano] = {};
      FONTES.forEach((f) => { kmAno[ano][f] = { km: 0, veiculos: 0 }; });
    }
    FONTES.forEach((f) => {
      kmAno[ano][f].km += row[f].km;
    });
  });
  Object.keys(kmAno).forEach((ano) => {
    FONTES.forEach((f) => {
      kmAno[ano][f].km = Math.round(kmAno[ano][f].km * 10) / 10;
      kmAno[ano][f].veiculos = veiculosAno.get(ano + "|" + f)?.size || 0;
    });
  });

  return { kmPorMes, kmAno };
}
