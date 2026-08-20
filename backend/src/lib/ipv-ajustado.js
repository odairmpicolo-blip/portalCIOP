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

function semAcento(s) {
  return String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Horário "10:40", " 9:52", "10h40" → minutos desde 00:00. */
export function minutosDeHora(v) {
  const m = String(v || "").trim().match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function duracaoMinutos(v) {
  const m = String(v || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Ponto oficial da linha — não cada checkpoint do CR-0108.
 * Terminais/estações iguais (piso, pista) viram um só.
 * Ruas/jumper viram o ponto de bairro, só quando a linha tem até 2 terminais
 * (ex.: 407 = Central + Gavetti + Bairro). A 904 tem 4 terminais e não ganha bairro extra.
 */
export function pontoOficial(nome) {
  const s = String(nome || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  const u = semAcento(s);
  if (/TERMINAL|ESTACAO/.test(u)) {
    if (u.includes("CENTRAL")) return "Terminal Central";
    return s.replace(/\s*[-–—]?\s*(piso|pista|inferior|superior).*$/i, "").trim();
  }
  return "Bairro";
}

export function pontosOficiaisDaLinha(nomes) {
  const terminais = new Set();
  let temBairro = false;
  for (const n of nomes || []) {
    const p = pontoOficial(n);
    if (!p) continue;
    if (p === "Bairro") temBairro = true;
    else terminais.add(p);
  }
  const lista = [...terminais].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (temBairro && terminais.size <= 2) lista.push("Bairro");
  return lista;
}

function pontoCitadoNaInstrucao(instrucao, oficial, pontoCru) {
  const t = semAcento(instrucao);
  if (!t) return false;
  if (oficial === "Terminal Central" && /TERMINAL|PISO|\bPI\b|PISTA/.test(t)) return true;
  if (oficial === "Terminal Milton Gavetti" && /GAVETTI/.test(t)) return true;
  if (oficial === "Bairro" && /BAIRRO|JOAO PAZ/.test(t)) return true;
  const cru = semAcento(pontoCru);
  const trecho = cru.replace(/TERMINAL|ESTACAO|AVENIDA|RUA/g, " ").replace(/\s+/g, " ").trim();
  const token = trecho.split(" ").find((w) => w.length >= 6);
  return Boolean(token && t.includes(token));
}

function distMinutos(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
}

/**
 * Uma passagem do CR-0108 só recupera ponto se tiver ligação de horário
 * (instrução do 002 × programado/realizado) ou o ponto citado no texto.
 * Sem relógio no 002, vale o ponto fora da régua −2/+6 na mesma viagem (veículo/linha/sentido).
 */
export function passagemConectaIncidente(passagem, incidente = {}) {
  const oficial = pontoOficial(passagem.ponto);
  if (!oficial) return null;
  const hora = minutosDeHora(incidente.instrucao) ?? minutosDeHora(incidente.natureza);
  const tPass = minutosDeHora(passagem.realizado) ?? minutosDeHora(passagem.programado);
  const janela = Math.max(15, duracaoMinutos(incidente.duracao) || 20);
  if (hora != null && tPass != null && distMinutos(hora, tPass) <= janela) {
    return { oficial, motivo: "horario" };
  }
  if (pontoCitadoNaInstrucao(incidente.instrucao, oficial, passagem.ponto)) {
    return { oficial, motivo: "texto" };
  }
  return null;
}

export function pontosRecuperadosDoIncidente(passagens, incidente = {}) {
  const vistos = new Map();
  for (const p of passagens || []) {
    const c = passagemConectaIncidente(p, incidente);
    if (c && !vistos.has(c.oficial)) vistos.set(c.oficial, c.motivo);
  }
  if (vistos.size) {
    return { extra: vistos.size, pontos: [...vistos.keys()], motivos: [...vistos.values()] };
  }
  for (const p of passagens || []) {
    const oficial = pontoOficial(p.ponto);
    const m = Number(p.desvio);
    if (!oficial || !Number.isFinite(m) || (m >= -2 && m <= 6)) continue;
    if (!vistos.has(oficial)) vistos.set(oficial, "fora-horario");
  }
  return { extra: vistos.size, pontos: [...vistos.keys()], motivos: [...vistos.values()] };
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
    const pontosControle = Math.max(0, Number(
      mapa.get(linha)?.pontos ?? mapa.get(linha)
    ) || 0);
    const pontosRecuperados = pontosControle > 0 ? n * pontosControle : 0;
    if (pontosControle <= 0) semCatalogo += n;
    extra += pontosRecuperados;
    const prev = porLinha.get(linha) || {
      linha, incidentes: 0, pontosControle: 0, pontosRecuperados: 0, comConexao: 0, semConexao: 0, nomes: []
    };
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

export function agregarExtras(incidentes) {
  const extraPorDia = new Map();
  const porLinha = new Map();
  let extra = 0;
  let nInc = 0;
  let semConexao = 0;
  for (const it of incidentes || []) {
    const linha = chaveLinha(it.linha);
    const data = String(it.data || "");
    const e = Math.max(0, Number(it.extra) || 0);
    nInc += 1;
    extra += e;
    if (e <= 0) semConexao += 1;
    if (data) {
      const d = extraPorDia.get(data) || { extra: 0, incidentes: 0, semConexao: 0 };
      d.extra += e;
      d.incidentes += 1;
      if (e <= 0) d.semConexao += 1;
      extraPorDia.set(data, d);
    }
    const prev = porLinha.get(linha) || {
      linha, incidentes: 0, pontosRecuperados: 0, semConexao: 0, pontos: []
    };
    prev.incidentes += 1;
    prev.pontosRecuperados += e;
    if (e <= 0) prev.semConexao += 1;
    for (const p of it.pontos || []) {
      if (p && !prev.pontos.includes(p)) prev.pontos.push(p);
    }
    porLinha.set(linha, prev);
  }
  return {
    extra,
    incidentes: nInc,
    semConexao,
    extraPorDia,
    porLinha: [...porLinha.values()].sort((a, b) =>
      b.pontosRecuperados - a.pontosRecuperados || String(a.linha).localeCompare(String(b.linha)))
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
