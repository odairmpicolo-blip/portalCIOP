/**
 * IPV Custom (Clever 2/6) com acréscimo das viagens do Relatório 002 (cr_0002).
 *
 * O 91,34% de junho é média ponderada: soma(ipv × pontos) / soma(pontos).
 * Cada incidente do 002 entra como uma viagem desculpada, convertida em pontos
 * pela média de pontos por viagem daquele dia (pontos / viagens).
 */
export function fracaoIpv(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1 ? n / 100 : n;
}

export function ipvAjustadoDia({ ipv, pontos, viagens, incidentes }) {
  const ipvN = fracaoIpv(ipv);
  const p = Math.max(0, Number(pontos) || 0);
  const v = Math.max(0, Number(viagens) || 0);
  const n = Math.max(0, Number(incidentes) || 0);
  const volume = p > 0 ? p : v;
  const porViagem = v > 0 && p > 0 ? p / v : 1;
  if (volume <= 0) {
    return {
      ipv: ipvN,
      ipvAjustado: null,
      noHorario: 0,
      extra: n * porViagem,
      volume: 0,
      porViagem,
      incidentes: n
    };
  }
  const noHorario = ipvN * volume;
  const extra = n * porViagem;
  return {
    ipv: ipvN,
    ipvAjustado: Math.min(1, (noHorario + extra) / volume),
    noHorario,
    extra,
    volume,
    porViagem,
    incidentes: n
  };
}

export function ipvAjustadoPeriodo(dias) {
  let noHorario = 0;
  let extra = 0;
  let volume = 0;
  let incidentes = 0;
  let ipvPuro = 0;
  for (const d of dias || []) {
    const a = ipvAjustadoDia(d);
    noHorario += a.noHorario;
    extra += a.extra;
    volume += a.volume;
    incidentes += a.incidentes;
  }
  if (volume > 0) ipvPuro = noHorario / volume;
  return {
    ipv: ipvPuro,
    ipvAjustado: volume > 0 ? Math.min(1, (noHorario + extra) / volume) : null,
    ganhoPp: volume > 0 ? Math.min(1, (noHorario + extra) / volume) * 100 - ipvPuro * 100 : 0,
    noHorario,
    extra,
    volume,
    incidentes,
    dias: (dias || []).length
  };
}
