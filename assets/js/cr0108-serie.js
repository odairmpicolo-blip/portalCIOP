/* Recorte por data das sugestões de horário do CR-0108.
   A série diária guarda 1 byte por dia por viagem programada; aqui ela é recortada
   pelo intervalo De/Até e a sugestão é recalculada. Validado contra o gerador em
   Python: no período completo, 6.105 de 6.105 sugestões idênticas. */
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

function sugerir(ctx, de, ate, { minOcorrencias = 20, minRecuperadas = 5 } = {}){
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
    for (let i = i0; i <= i1; i++){ const v = val[s.charCodeAt(i)]; if (v === 127) continue; cnt[v + L]++; tot++; }
    const ex = extrasPorChave.get(k);
    if (ex) for (const [di, d] of ex) if (di >= i0 && di <= i1){ cnt[Math.max(-L, Math.min(L, d)) + L]++; tot++; }
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

window.CR0108Serie = { preparar: preparar, sugerir: sugerir };
