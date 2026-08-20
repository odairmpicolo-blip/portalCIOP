import { HttpError } from "./http.js";

export const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function ehDataIso(valor) {
  const s = String(valor || "").trim().slice(0, 10);
  if (!DATA_ISO.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function dataIsoOuVazio(valor) {
  const s = String(valor || "").trim().slice(0, 10);
  if (!s) return "";
  if (!ehDataIso(s)) {
    throw new HttpError(400, "Data inválida (YYYY-MM-DD)", "DATA_INVALIDA");
  }
  return s;
}

export function exigirDataIso(valor, nome = "data") {
  const s = dataIsoOuVazio(valor);
  if (!s) {
    throw new HttpError(400, `${nome} obrigatória (YYYY-MM-DD)`, "DATA_OBRIGATORIA");
  }
  return s;
}

/** Intervalo inclusivo. `obrigatorio` exige de e ate. */
export function intervaloDatas(de, ate, { obrigatorio = true } = {}) {
  const dataDe = obrigatorio ? exigirDataIso(de, "de") : dataIsoOuVazio(de);
  const dataAte = obrigatorio ? exigirDataIso(ate, "ate") : dataIsoOuVazio(ate);
  if (dataDe && dataAte && dataAte < dataDe) {
    throw new HttpError(400, "Parâmetro ate deve ser maior ou igual a de", "INTERVALO_INVALIDO");
  }
  if (obrigatorio && (!dataDe || !dataAte)) {
    throw new HttpError(400, "Parâmetros de e ate obrigatórios (YYYY-MM-DD)", "INTERVALO_OBRIGATORIO");
  }
  return { de: dataDe, ate: dataAte };
}

export function exigirObjeto(valor, mensagem = "Payload inválido") {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new HttpError(400, mensagem, "PAYLOAD_INVALIDO");
  }
  return valor;
}
