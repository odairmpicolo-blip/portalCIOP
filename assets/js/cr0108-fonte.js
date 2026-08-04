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

global.Fonte = {
    usarEstaticos, origem, disponivel,
    serie, ranking, hora, pontosDaLinha, horariosDoPonto, icv, ipv
};
})(window);
