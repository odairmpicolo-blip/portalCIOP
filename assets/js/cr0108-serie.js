/* Série diária do CR-0108: recorte por data das sugestões e detalhamento em cascata
   do ranking (linha -> ponto de controle -> horário -> sugestão).
   Validado contra o gerador em Python: 6.105 de 6.105 sugestões idênticas, e os
   totais por ponto e por horário conferem com o cálculo direto dos CSVs. */
/* Núcleo do cálculo que vai rodar no navegador: recorta a série diária por De/Até e
   refaz a sugestão de horário. Exportado para poder ser testado fora da página. */
function preparar(S){
  const val = new Int8Array(256).fill(127);
  for (let i = 1; i < S.alfabeto.length; i++) val[S.alfabeto.charCodeAt(i)] = i - 1 - S.limite;
  const extrasPorChave = new Map();
  for (const [k, di, d] of (S.extras || [])) {
    if (!extrasPorChave.has(k)) extrasPorChave.set(k, []);
    extrasPorChave.get(k).push([di, d]);
  }
  return { S, val, extrasPorChave };
}
function avalia(cnt, tot, L){
  let atual = 0;
  for (let d = -L; d <= L; d++){ const n = cnt[d + L]; if (n && d >= -2 && d <= 6) atual += n; }
  let melhorS = 0, melhor = atual;
  for (let s = -20; s <= 20; s++){
    let v = 0;
    for (let d = -L; d <= L; d++){ const n = cnt[d + L]; if (!n) continue; const x = d - s; if (x >= -2 && x <= 6) v += n; }
    if (v > melhor || (v === melhor && Math.abs(s) < Math.abs(melhorS))){ melhor = v; melhorS = s; }
  }
  const a10 = Math.floor(tot * 0.10), a90 = Math.floor(tot * 0.90);
  const medIdx = tot % 2 ? [(tot - 1) / 2] : [tot / 2 - 1, tot / 2];
  let acc = 0, p10 = null, p90 = null; const medVals = [];
  for (let d = -L; d <= L; d++){
    const n = cnt[d + L]; if (!n) continue;
    for (const mi of medIdx) if (medVals.length < medIdx.length && acc <= mi && mi < acc + n) medVals.push(d);
    if (p10 === null && acc <= a10 && a10 < acc + n) p10 = d;
    if (p90 === null && acc <= a90 && a90 < acc + n) p90 = d;
    acc += n;
  }
  const mediana = medVals.length === 2 ? (medVals[0] + medVals[1]) / 2 : medVals[0];
  return { n: tot, pctAtual: 100 * atual / tot, shift: melhorS, pctPotencial: 100 * melhor / tot,
           ganhoPct: 100 * (melhor - atual) / tot, recuperadas: melhor - atual, mediana, amplitude: p90 - p10 };
}
const hm = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hhmm = mi => { mi = ((mi % 1440) + 1440) % 1440; return `${String(Math.floor(mi/60)).padStart(2,"0")}:${String(mi%60).padStart(2,"0")}`; };

function avaliarHistograma(cnt, tot, L){ return avalia(cnt, tot, L); }
const paraMin = hm;
const paraHm = hhmm;

function sugerir(ctx, de, ate, { minOcorrencias = 20, minRecuperadas = 5, tipoDia } = {}){
  const { S, val, extrasPorChave } = ctx;
  const L = S.limite;
  let i0 = S.dias.findIndex(d => d >= de); if (i0 < 0) return [];
  let i1 = S.dias.length - 1; while (i1 >= 0 && S.dias[i1] > ate) i1--;
  if (i1 < i0) return [];
  const cnt = new Int32Array(2 * L + 1);
  const out = [];
  for (let k = 0; k < S.chaves.length; k++){
    cnt.fill(0); let tot = 0;
    const s = S.series[k];
    for (let i = i0; i <= i1; i++){ if (!passaTipoDia(S.dias[i], tipoDia)) continue; const v = val[s.charCodeAt(i)]; if (v === 127) continue; cnt[v + L]++; tot++; }
    const ex = extrasPorChave.get(k);
    if (ex) for (const [di, d] of ex) if (di >= i0 && di <= i1 && passaTipoDia(S.dias[di], tipoDia)){ cnt[Math.max(-L, Math.min(L, d)) + L]++; tot++; }
    if (tot < minOcorrencias) continue;
    const a = avalia(cnt, tot, L);
    if (a.shift === 0 || a.recuperadas < minRecuperadas) continue;
    const [linha, sentido, ponto, programado] = S.chaves[k];
    out.push({ linha, sentido, ponto, programado, sugerido: hhmm(hm(programado) + a.shift),
               n: a.n, pctAtual: +a.pctAtual.toFixed(2), shift: a.shift,
               pctPotencial: +a.pctPotencial.toFixed(2), ganhoPct: +a.ganhoPct.toFixed(2),
               recuperadas: a.recuperadas, mediana: a.mediana, amplitude: a.amplitude });
  }
  out.sort((a, b) => b.recuperadas - a.recuperadas);
  return out;
}

/* ---- Detalhamento em cascata do ranking do CR-0108 ----------------------------
   Linha -> pontos de controle -> horários com problema -> sugestão de ajuste.
   Tudo sai da mesma série diária, então os números fecham entre os níveis.
   Régua do CIOP: -2..+6 no horário | -10..-3 adiantado | +7..+15 atrasado | resto divergente. */
function classe(d){
    if (d >= -2 && d <= 6) return "noHorario";
    if (d >= -10 && d <= -3) return "adiantado";
    if (d >= 7 && d <= 15) return "atrasado";
    return "divergente";
}
function zero(){ return { noHorario: 0, adiantado: 0, atrasado: 0, divergente: 0, total: 0, somaDif: 0 }; }

function janela(S, de, ate){
    let i0 = S.dias.findIndex(d => d >= de);
    if (i0 < 0) return null;
    let i1 = S.dias.length - 1;
    while (i1 >= 0 && S.dias[i1] > ate) i1--;
    return i1 < i0 ? null : [i0, i1];
}

/* Percorre a série aplicando `visita(k, desvio)` em cada passagem do recorte que
   passe pelo filtro `aceita(chave)`. Centraliza o tratamento das passagens extras. */
function passaTipoDia(iso, tipo){
    const t = String(tipo || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!t || t === "todos") return true;
    const d = new Date(iso + "T12:00:00").getDay();
    if (t === "uteis") return d >= 1 && d <= 5;
    if (t === "sabado") return d === 6;
    if (t === "domingo") return d === 0;
    return true;
}

function varrer(ctx, de, ate, aceita, visita, tipoDia){
    const { S, val, extrasPorChave } = ctx;
    const lim = janela(S, de, ate);
    if (!lim) return;
    const [i0, i1] = lim;
    for (let k = 0; k < S.chaves.length; k++){
        if (!aceita(S.chaves[k])) continue;
        const s = S.series[k];
        for (let i = i0; i <= i1; i++){
            if (!passaTipoDia(S.dias[i], tipoDia)) continue;
            const v = val[s.charCodeAt(i)];
            if (v !== 127) visita(k, v);
        }
        const ex = extrasPorChave.get(k);
        if (ex) for (const [di, d] of ex) {
            if (di >= i0 && di <= i1 && passaTipoDia(S.dias[di], tipoDia)) visita(k, Math.max(-S.limite, Math.min(S.limite, d)));
        }
    }
}

function somar(acc, d){
    acc[classe(d)] += 1;
    acc.total += 1;
    acc.somaDif += d;
}

/** Pontos de controle de uma linha, no recorte de datas. */
function pontosDaLinha(ctx, linha, sentido, de, ate, tipoDia){
    const mapa = new Map();
    varrer(ctx, de, ate,
        ch => ch[0] === linha && (!sentido || ch[1] === sentido),
        (k, d) => {
            const ch = ctx.S.chaves[k];
            const id = ch[1] + "" + ch[2];
            let a = mapa.get(id);
            if (!a){ a = { sentido: ch[1], ponto: ch[2], ...zero() }; mapa.set(id, a); }
            somar(a, d);
        }, tipoDia);
    /* Ordena por IMPACTO — passagens fora do horário — e não por percentual: um ponto
       com 3 passagens e 0% no horário não pode liderar a lista na frente de um com
       2.000 passagens e 60%. É o mesmo critério do ranking principal. */
    return [...mapa.values()].sort((a, b) =>
        (b.total - b.noHorario) - (a.total - a.noHorario));
}

/** Horários de um ponto, já com a sugestão de ajuste de cada um. */
function horariosDoPonto(ctx, linha, sentido, ponto, de, ate, minOcorrencias = 20, tipoDia){
    const porChave = new Map();
    varrer(ctx, de, ate,
        ch => ch[0] === linha && ch[2] === ponto && (!sentido || ch[1] === sentido),
        (k, d) => {
            let a = porChave.get(k);
            if (!a){ a = { chave: k, cnt: new Int32Array(2 * ctx.S.limite + 1), ...zero() }; porChave.set(k, a); }
            a.cnt[d + ctx.S.limite] += 1;
            somar(a, d);
        }, tipoDia);
    const L = ctx.S.limite;
    const saida = [];
    for (const a of porChave.values()){
        const ch = ctx.S.chaves[a.chave];
        const item = { sentido: ch[1], programado: ch[3], noHorario: a.noHorario, adiantado: a.adiantado,
                       atrasado: a.atrasado, divergente: a.divergente, total: a.total, somaDif: a.somaDif,
                       shift: 0, sugerido: null, recuperadas: 0, pctPotencial: null, massaSuficiente: a.total >= minOcorrencias };
        if (item.massaSuficiente){
            const av = avaliarHistograma(a.cnt, a.total, L);
            item.shift = av.shift;
            item.recuperadas = av.recuperadas;
            item.pctPotencial = av.pctPotencial;
            if (av.shift !== 0) item.sugerido = paraHm(paraMin(ch[3]) + av.shift);
        }
        saida.push(item);
    }
    return saida.sort((a, b) => paraMin(a.programado) - paraMin(b.programado));
}

window.CR0108Serie = {
    preparar: preparar,
    sugerir: sugerir,
    pontosDaLinha: pontosDaLinha,
    horariosDoPonto: horariosDoPonto
};
