/**
 * IPV Custom (Clever 2/6) com incidentes do Relatório 002 (cr_0002).
 *
 * O 91,34% de junho é soma(ipv × pontos) / soma(pontos) — os “pontos” são
 * passagens em ponto de controle, não viagens.
 *
 * Cada incidente é 1 viagem. Essa viagem passa por todos os pontos da linha
 * (ex.: 904 = Acapulco, Catuai, Oeste, Vivi Xavier → 4 pontos). O acréscimo
 * no numerador é incidentes × pontos daquela linha, não uma média da rede.
 */
export function fracaoIpv(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1 ? n / 100 : n;
}

export function chaveLinha(v) {
  const s = String(v || "").trim().toUpperCase();
  if (!s) return "";
  const num = s.match(/(\d{2,5})/);
  if (num) return String(Number(num[1]));
  const semZero = s.replace(/^0+/, "");
  return semZero || s;
}

export function numeroCampo(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function extraPontosIncidentes(itens, catalogo) {
  const mapa = catalogo instanceof Map ? catalogo : new Map(Object.entries(catalogo || {}));
  const porLinha = new Map();
  let extra = 0;
  let incidentes = 0;
  let semCatalogo = 0;
  for (const it of itens || []) {
    const linha = chaveLinha(it.linha);
    const n = Math.max(0, Number(it.n) || 0);
    if (!n) continue;
    incidentes += n;
    const pontosControle = Math.max(0, Number(mapa.get(linha)) || 0);
    const pontosRecuperados = pontosControle > 0 ? n * pontosControle : 0;
    if (pontosControle <= 0) semCatalogo += n;
    extra += pontosRecuperados;
    const prev = porLinha.get(linha) || { linha, incidentes: 0, pontosControle: 0, pontosRecuperados: 0 };
    prev.incidentes += n;
    prev.pontosControle = Math.max(prev.pontosControle, pontosControle);
    prev.pontosRecuperados += pontosRecuperados;
    porLinha.set(linha, prev);
  }
  return {
    extra,
    incidentes,
    semCatalogo,
    porLinha: [...porLinha.values()].sort((a, b) => b.pontosRecuperados - a.pontosRecuperados || a.linha.localeCompare(b.linha))
  };
}

export function ipvAjustadoDia({ ipv, pontos, extraPontos = 0, incidentes = 0 }) {
  const ipvN = fracaoIpv(ipv);
  const volume = Math.max(0, Number(pontos) || 0);
  const extra = Math.max(0, Number(extraPontos) || 0);
  const n = Math.max(0, Number(incidentes) || 0);
  const noHorario = ipvN * volume;
  if (volume <= 0) {
    return { ipv: ipvN, ipvAjustado: null, noHorario: 0, extra, volume: 0, incidentes: n };
  }
  return {
    ipv: ipvN,
    ipvAjustado: Math.min(1, (noHorario + extra) / volume),
    noHorario,
    extra,
    volume,
    incidentes: n
  };
}

export function ipvAjustadoPeriodo(dias) {
  let noHorario = 0;
  let extra = 0;
  let volume = 0;
  let incidentes = 0;
  for (const d of dias || []) {
    const a = ipvAjustadoDia(d);
    noHorario += a.noHorario;
    extra += a.extra;
    volume += a.volume;
    incidentes += a.incidentes;
  }
  const ipvPuro = volume > 0 ? noHorario / volume : 0;
  const ipvAjustado = volume > 0 ? Math.min(1, (noHorario + extra) / volume) : null;
  return {
    ipv: ipvPuro,
    ipvAjustado,
    ganhoPp: ipvAjustado != null ? ipvAjustado * 100 - ipvPuro * 100 : 0,
    noHorario,
    extra,
    volume,
    incidentes,
    dias: (dias || []).length
  };
}
