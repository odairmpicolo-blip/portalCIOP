(function (global) {
"use strict";

/**
 * Fonte de dados do CR-0108: Aurora DSQL quando disponível, arquivos estáticos quando não.
 *
 * A página sempre pediu os agregados já filtrados. A diferença é de onde eles vêm:
 *
 *   BANCO    — /cr0108/* aplica o recorte de data no SQL, sobre a passagem crua.
 *              Ranking de ponto, operador e veículo passa a aceitar qualquer intervalo.
 *   ARQUIVO  — os JSONs publicados. Ponto, operador e veículo são MENSAIS, então o
 *              recorte é arredondado para os meses que tocam o período escolhido.
 *
 * O fallback não é decoração: se o Lambda estiver fora, ou o usuário sem token, a
 * página continua funcionando como sempre funcionou. `origem()` diz qual está valendo
 * para a tela poder mostrar isso ao operador.
 */

let API = null;          // null = ainda não testado; false = indisponível
/* Quando ligado, a Fonte responde pelos arquivos mesmo com o banco no ar. Serve para
   a primeira pintura da tela: o arquivo responde em milissegundos e o banco leva
   segundos, entao mostramos o que ja temos e trocamos quando o banco chega. */
let SO_ARQUIVO = false;
function usarSoArquivo(v) { SO_ARQUIVO = !!v; }
let tokenCache = null;
let ESTATICO = null;     // dados dos JSONs, entregues pela página

function usarEstaticos(dados) { ESTATICO = dados; }

function origem() { return API ? "banco" : "arquivo"; }

async function token() {
  if (tokenCache && tokenCache.exp > Date.now()) return tokenCache.valor;
  const { firebaseIdToken } = await import("./portal-aws-config.js");
  const valor = await firebaseIdToken();
  tokenCache = { valor, exp: Date.now() + 5 * 60 * 1000 };
  return valor;
}

async function chamar(caminho, params = {}) {
  const { awsFetch } = await import("./portal-aws-config.js");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const sufixo = qs.toString() ? `?${qs}` : "";
  return awsFetch(`/cr0108${caminho}${sufixo}`, { token: await token() });
}

/** Testa uma vez se o banco responde. Qualquer erro derruba para o arquivo. */
async function disponivel() {
  if (SO_ARQUIVO) return false;
  if (API !== null) return API;
  try {
    /* A URL da API vem de assets/data/portal-runtime.json e só existe DEPOIS de
       initPortalAwsRuntime(). Sem esperar por ela, awsApiEnabled() responde "não"
       e a página ficava presa no arquivo mesmo com o banco no ar. */
    /* O modulo de configuracao chama-se portal-aws-config.js. O import apontava
       para um nome que nao existe no repositorio: dava 404, o import falhava, o
       catch abaixo engolia o erro e a Fonte ficava presa no arquivo para sempre. */
    const cfg = await import("./portal-aws-config.js");
    if (typeof cfg.initPortalAwsRuntime === "function") await cfg.initPortalAwsRuntime();
    if (!cfg.awsApiEnabled()) { API = false; return false; }
    const r = await chamar("/meta");
    API = Boolean(r && r.ok && r.registros > 0);
  } catch (err) {
    console.info("CR-0108: banco indisponível, usando os arquivos.", err.message);
    API = false;
  }
  return API;
}

/* ------------------------------------------------------------------ auxiliares do modo arquivo */

const dentro = (iso, p) => iso >= p.de && iso <= p.ate;

/** Meses tocados pelo período — o recorte possível quando a base é mensal. */
function mesesDoPeriodo(p) {
  const meses = new Set();
  const [ay, am] = p.de.split("-").map(Number);
  const [by, bm] = p.ate.split("-").map(Number);
  for (let y = ay, m = am; y < by || (y === by && m <= bm); m === 12 ? (m = 1, y++) : m++) {
    meses.add(`${y}-${String(m).padStart(2, "0")}`);
  }
  return meses;
}

const zero = () => ({ noHorario: 0, adiantado: 0, atrasado: 0, divergente: 0, total: 0, somaDif: 0, semDif: 0 });

function acumular(acc, r) {
  acc.noHorario += r.noHorario || 0;
  acc.adiantado += r.adiantado || 0;
  acc.atrasado  += r.atrasado  || 0;
  acc.divergente += r.divergente || 0;
  acc.total     += r.total     || 0;
  acc.somaDif   += r.somaDif   || 0;
  acc.semDif    += r.semDif    || 0;
  return acc;
}

/* ------------------------------------------------------------------ evolução por dia */

async function serie(p) {
  if (await disponivel()) {
    const r = await chamar("/serie", p);
    /* periodoLongo = a janela passa do limite do banco (o SQL levaria mais que os
       30 s do gateway). Nao retornamos nada aqui: o codigo do arquivo, logo abaixo,
       responde com os agregados publicados - que sao identicos, so menos recentes. */
    if (!r.periodoLongo) return r.itens.map(x => ({ ...x, total: +x.total, noHorario: +x.noHorario, adiantado: +x.adiantado,
      atrasado: +x.atrasado, divergente: +x.divergente, somaDif: +x.somaDif, semDif: +x.semDif }));
  }
  /* No arquivo não existe série diária cruzada com sentido — o agregado que tem
     sentido é mensal. Devolver null avisa a página, que mostra a explicação.
     Com o banco isso não acontece: o SQL filtra sentido na passagem crua. */
  if (p.sentido) return null;
  const base = p.linha ? ESTATICO.porDiaLinha : ESTATICO.porDia;
  const mapa = new Map();
  base.forEach(r => {
    if (!dentro(r.data, p)) return;
    if (p.linha && r.linha !== p.linha) return;
    if (!mapa.has(r.data)) mapa.set(r.data, { data: r.data, ...zero() });
    acumular(mapa.get(r.data), r);
  });
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}

/* ------------------------------------------------------------------ ranking */

const ESTATICA_POR_DIM = {
  linha:    { base: "porDiaLinha",   campo: "linha",     diario: true  },
  ponto:    { base: "porMesPonto",   campo: "ponto",     diario: false },
  operador: { base: "porMesOperador", campo: "matricula", diario: false },
  veiculo:  { base: "porMesVeiculo", campo: "veiculo",   diario: false }
};

async function ranking(dim, p) {
  if (await disponivel()) {
    const r = await chamar("/ranking", { ...p, dim });
    if (!r.periodoLongo) return {
      exato: true,
      itens: r.itens.map(x => ({
        chave: x.chave, rotulo: x.chave, extra: x.nome || "",
        total: +x.total, noHorario: +x.noHorario, adiantado: +x.adiantado,
        atrasado: +x.atrasado, divergente: +x.divergente, somaDif: +x.somaDif, semDif: +x.semDif
      }))
    };
  }

  const cfg = ESTATICA_POR_DIM[dim];
  if (!cfg) return { exato: false, itens: [] };
  const mapa = new Map();

  if (cfg.diario) {
    ESTATICO[cfg.base].forEach(r => {
      if (!dentro(r.data, p)) return;
      if (p.linha && r.linha !== p.linha) return;
      const k = r[cfg.campo];
      if (!mapa.has(k)) mapa.set(k, { chave: k, rotulo: k, extra: ESTATICO.meta.linhas[k] || "", ...zero() });
      acumular(mapa.get(k), r);
    });
  } else {
    const meses = mesesDoPeriodo(p);
    ESTATICO[cfg.base].forEach(r => {
      if (!meses.has(r.mes)) return;
      const k = r[cfg.campo];
      if (!mapa.has(k)) mapa.set(k, { chave: k, rotulo: k, extra: r.nome || "", ...zero() });
      acumular(mapa.get(k), r);
    });
  }
  // exato=false avisa a tela: sem banco, estas dimensões são mensais, não diárias.
  return { exato: cfg.diario, itens: [...mapa.values()] };
}

/* ------------------------------------------------------------------ faixa horária */

async function hora(p) {
  if (await disponivel()) {
    const r = await chamar("/hora", p);
    if (!r.periodoLongo) return r.itens.map(x => ({ hora: x.hora, total: +x.total, noHorario: +x.noHorario,
      adiantado: +x.adiantado, atrasado: +x.atrasado, divergente: +x.divergente,
      somaDif: +x.somaDif, semDif: +x.semDif }));
  }
  const mapa = new Map();
  if (!p.linha && !p.sentido) {
    ESTATICO.porDiaHora.forEach(r => {
      if (!dentro(r.data, p)) return;
      if (!mapa.has(r.hora)) mapa.set(r.hora, { hora: r.hora, ...zero() });
      acumular(mapa.get(r.hora), r);
    });
  } else {
    const meses = mesesDoPeriodo(p);
    ESTATICO.porMesHoraLinha.forEach(r => {
      if (!meses.has(r.m)) return;
      if (p.linha && r.l !== p.linha) return;
      if (p.sentido && r.s !== p.sentido) return;
      if (!mapa.has(r.h)) mapa.set(r.h, { hora: r.h, ...zero() });
      acumular(mapa.get(r.h), { noHorario: r.n, adiantado: r.a, atrasado: r.t, divergente: r.d, total: r.T, somaDif: 0 });
    });
  }
  return [...mapa.values()].sort((a, b) => a.hora.localeCompare(b.hora));
}

/* ------------------------------------------------------------------ cascata */

async function pontosDaLinha(linha, p) {
  if (await disponivel()) {
    const r = await chamar("/pontos", { ...p, linha });
    if (!r.periodoLongo) return r.itens.map(x => ({ ponto: x.ponto, sentido: x.sentido, total: +x.total,
      noHorario: +x.noHorario, adiantado: +x.adiantado, atrasado: +x.atrasado,
      divergente: +x.divergente, somaDif: +x.somaDif }));
  }
  const ctx = await serieDiariaLocal();
  return window.CR0108Serie.pontosDaLinha(ctx, linha, p.sentido || "", p.de, p.ate);
}

async function horariosDoPonto(linha, sentido, ponto, p) {
  if (await disponivel()) {
    const r = await chamar("/horarios", { ...p, linha, ponto, sentido });
    if (!r.periodoLongo) return r.itens.map(x => avaliarNoNavegador(x));
  }
  const ctx = await serieDiariaLocal();
  return window.CR0108Serie.horariosDoPonto(ctx, linha, sentido, ponto, p.de, p.ate);
}

/* O banco devolve o histograma de desvios; o melhor deslocamento (-20..+20) é
   calculado aqui, como já era feito com a série diária. */
function avaliarNoNavegador(x) {
  const desvios = (x.desvios || []).map(Number);
  const base = {
    sentido: x.sentido, programado: x.programado,
    total: +x.total, noHorario: +x.noHorario, adiantado: +x.adiantado,
    atrasado: +x.atrasado, divergente: +x.divergente, somaDif: +x.somaDif,
    massaSuficiente: +x.total >= 20, shift: 0, sugerido: null, recuperadas: 0, pctPotencial: null
  };
  if (!base.massaSuficiente || !desvios.length) return base;

  const noHorario = s => desvios.reduce((n, d) => n + ((d - s >= -2 && d - s <= 6) ? 1 : 0), 0);
  const atual = noHorario(0);
  let melhor = atual, melhorS = 0;
  for (let s = -20; s <= 20; s++) {
    const v = noHorario(s);
    if (v > melhor || (v === melhor && Math.abs(s) < Math.abs(melhorS))) { melhor = v; melhorS = s; }
  }
  base.shift = melhorS;
  base.recuperadas = melhor - atual;
  base.pctPotencial = 100 * melhor / desvios.length;
  if (melhorS !== 0) {
    const [h, m] = x.programado.split(":").map(Number);
    const mi = ((h * 60 + m + melhorS) % 1440 + 1440) % 1440;
    base.sugerido = `${String(Math.floor(mi / 60)).padStart(2, "0")}:${String(mi % 60).padStart(2, "0")}`;
  }
  return base;
}

let ctxSerie = null;
async function serieDiariaLocal() {
  if (ctxSerie) return ctxSerie;
  const res = await fetch("../assets/data/cr0108/serie-diaria.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("serie-diaria: HTTP " + res.status);
  ctxSerie = window.CR0108Serie.preparar(await res.json());
  return ctxSerie;
}


/* ------------------------------------------------------------------ ICV e IPV
   Vivem no banco (cr_custom e cr_custom_ontime), 213 dias completos. Nao ha
   equivalente em arquivo, entao sem banco devolvemos null e a tela avisa. */

async function icv(p) {
  if (!(await disponivel())) return null;
  const r = await chamar("/icv", p);
  return r.itens.map(x => ({ ...x, icv: +x.icv, ipv: +x.ipv }));
}

async function ipv(p) {
  if (!(await disponivel())) return null;
  const r = await chamar("/ipv", p);
  return r.itens.map(x => ({ ...x, ipv: +x.ipv }));
}

async function operador(p) {
  if (!(await disponivel())) return null;
  const r = await chamar("/operador", p);
  if (!r || r.periodoLongo || !r.itens) return null;
  return r.itens.map(x => ({
    mes: x.mes, matricula: x.matricula, nome: x.nome,
    noHorario: +x.noHorario, adiantado: +x.adiantado, atrasado: +x.atrasado,
    divergente: +x.divergente, total: +x.total, somaDif: +x.somaDif, semDif: +x.semDif || 0
  }));
}

async function operadorLinha(p) {
  if (!(await disponivel())) return null;
  const r = await chamar("/operador-linha", p);
  if (!r || r.periodoLongo || !r.itens) return null;
  return r.itens;
}

function avaliaHist(cnt) {
  let total = 0;
  for (const n of Object.values(cnt)) total += n;
  if (!total) return null;
  const noHorario = (s) => {
    let v = 0;
    for (const [d, n] of Object.entries(cnt)) {
      const x = Number(d) - s;
      if (x >= -2 && x <= 6) v += n;
    }
    return v;
  };
  const atual = noHorario(0);
  let melhor = atual, melhorS = 0;
  for (let s = -20; s <= 20; s++) {
    const v = noHorario(s);
    if (v > melhor || (v === melhor && Math.abs(s) < Math.abs(melhorS))) {
      melhor = v; melhorS = s;
    }
  }
  const desvios = [];
  Object.keys(cnt).sort((a, b) => Number(a) - Number(b)).forEach(d => {
    for (let i = 0; i < cnt[d]; i++) desvios.push(Number(d));
  });
  const p10 = desvios[Math.floor(desvios.length * 0.10)];
  const p90 = desvios[Math.floor(desvios.length * 0.90)];
  const mediana = desvios[Math.floor(desvios.length / 2)];
  return {
    n: total,
    pctAtual: Math.round(10000 * atual / total) / 100,
    shift: melhorS,
    pctPotencial: Math.round(10000 * melhor / total) / 100,
    ganhoPct: Math.round(10000 * (melhor - atual) / total) / 100,
    recuperadas: melhor - atual,
    mediana, p10, p90, amplitude: p90 - p10
  };
}

function hmShift(prog, shift) {
  const m = String(prog || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const mi = (((Number(m[1]) * 60 + Number(m[2]) + shift) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mi / 60)).padStart(2, "0")}:${String(mi % 60).padStart(2, "0")}`;
}

/** Converte o histograma do banco no mesmo formato dos JSONs de ajustes. */
function montarAjustes(bins, nomes = {}) {
  const porHorario = new Map();
  (bins || []).forEach(b => {
    const k = [b.linha, b.sentido, b.ponto, b.programado].join("\u0001");
    let cnt = porHorario.get(k);
    if (!cnt) {
      cnt = { linha: b.linha, sentido: b.sentido, ponto: b.ponto, programado: b.programado, cnt: {} };
      porHorario.set(k, cnt);
    }
    cnt.cnt[String(b.desvio)] = (cnt.cnt[String(b.desvio)] || 0) + Number(b.n || 0);
  });

  const porPonto = new Map();
  const porFaixa = new Map();
  const horarios = [];
  porHorario.forEach(h => {
    const a = avaliaHist(h.cnt);
    if (!a) return;
    const pk = [h.linha, h.sentido, h.ponto].join("\u0001");
    if (!porPonto.has(pk)) {
      porPonto.set(pk, { linha: h.linha, sentido: h.sentido, ponto: h.ponto, cnt: {} });
    }
    const pto = porPonto.get(pk);
    Object.entries(h.cnt).forEach(([d, n]) => { pto.cnt[d] = (pto.cnt[d] || 0) + n; });

    const hora = /^\d{2}:/.test(h.programado) ? h.programado.slice(0, 2) : "??";
    const fk = pk + "\u0001" + hora;
    if (!porFaixa.has(fk)) porFaixa.set(fk, { hora, cnt: {} });
    const fx = porFaixa.get(fk);
    Object.entries(h.cnt).forEach(([d, n]) => { fx.cnt[d] = (fx.cnt[d] || 0) + n; });

    if (!/^\d{1,2}:\d{2}$/.test(h.programado) || a.n < 20) return;
    if (a.shift === 0 || a.recuperadas < 5) return;
    horarios.push({
      linha: h.linha, sentido: h.sentido, ponto: h.ponto,
      programado: h.programado, sugerido: hmShift(h.programado, a.shift),
      ...a
    });
  });

  const pontos = [];
  porPonto.forEach((p, pk) => {
    const a = avaliaHist(p.cnt);
    if (!a || a.n < 60) return;
    const faixas = [];
    porFaixa.forEach((f, fk) => {
      if (!fk.startsWith(pk + "\u0001")) return;
      const af = avaliaHist(f.cnt);
      if (!af || af.n < 20) return;
      faixas.push({ hora: f.hora, ...af });
    });
    faixas.sort((x, y) => y.recuperadas - x.recuperadas);
    pontos.push({
      linha: p.linha, linhaNome: nomes[p.linha] || "",
      sentido: p.sentido, ponto: p.ponto, ...a,
      faixas: faixas.slice(0, 5),
      faixasHomogeneas: faixas.length ? (new Set(faixas.map(f => f.shift)).size <= 2) : null
    });
  });
  pontos.sort((a, b) => b.recuperadas - a.recuperadas);
  horarios.sort((a, b) => b.recuperadas - a.recuperadas);
  return { pontos, horarios };
}

async function histograma(p) {
  if (!(await disponivel())) return null;
  const r = await chamar("/histograma", p);
  if (!r || r.periodoLongo || !r.itens) return null;
  return montarAjustes(r.itens, p.nomes || {});
}

function mesAtualCad() {
  const br = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = br.split("-");
  const ultimo = new Date(Number(y), Number(m), 0).getDate();
  return {
    de: `${y}-${m}-01`,
    ate: `${y}-${m}-${String(ultimo).padStart(2, "0")}`
  };
}

async function cad(p) {
  try {
    if (SO_ARQUIVO) return { ok: false, erro: "modo arquivo", itens: [] };
    const cfg = await import("./portal-aws-config.js");
    if (typeof cfg.initPortalAwsRuntime === "function") await cfg.initPortalAwsRuntime();
    if (!cfg.awsApiEnabled()) return { ok: false, erro: "API AWS não configurada", itens: [] };
    const mes = mesAtualCad();
    const limite = Number(p?.limite) || 1500;
    const base = { de: mes.de, ate: mes.ate, ...(p || {}) };
    delete base.pagina;
    delete base.limite;
    let pagina = 1;
    let itens = [];
    let colunas = [];
    let meta = {};
    let prevSig = "";
    while (pagina <= 40) {
      const r = await chamar("/cad", { ...base, pagina, limite });
      if (!r) return { ok: false, erro: "resposta vazia da API", itens };
      if (r.ok === false) return itens.length ? { ...r, ok: true, itens, colunas, meta } : r;
      colunas = r.colunas && r.colunas.length ? r.colunas : colunas;
      meta = r.meta || meta;
      const lote = Array.isArray(r.itens) ? r.itens : [];
      const sig = JSON.stringify(lote[0] || null);
      if (pagina > 1 && sig && sig === prevSig) break;
      prevSig = sig;
      itens = itens.concat(lote);
      const total = Number(meta.total || 0);
      if (!lote.length) break;
      if (total && itens.length >= total) break;
      if (lote.length < limite) break;
      if (meta.temMais === false) break;
      pagina += 1;
    }
    return {
      ok: true,
      origem: "dsql",
      tabela: "cr_0002",
      colunas,
      meta: { ...meta, total: Number(meta.total || itens.length), carregados: itens.length, de: base.de, ate: base.ate, janela: "mes-atual" },
      itens
    };
  } catch (err) {
    return { ok: false, erro: err.message || String(err), itens: [] };
  }
}

async function ranking001(p) {
  if (!(await disponivel())) return null;
  const r = await chamar("/ranking-001", p);
  if (!r || !r.ok) return null;
  return r;
}

/* Período e totais segundo o banco. A página usa isto para corrigir o cabeçalho, o
   selo de atualização e os limites dos campos de data, que sem isso ficam presos no
   último dia do meta.json. */
async function meta() {
  if (!(await disponivel())) return null;
  const r = await chamar("/meta");
  return r && r.ok ? r : null;
}

global.Fonte = {
    usarEstaticos, usarSoArquivo, origem, disponivel,
    meta, serie, ranking, hora, pontosDaLinha, horariosDoPonto, icv, ipv,
    operador, operadorLinha, histograma, cad, ranking001, montarAjustes
};
})(window);
