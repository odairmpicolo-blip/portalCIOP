import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Executa os handlers reais com apenas transporte HTTP e banco substituídos.
const fonte = fs.readFileSync(new URL('../routes/cr0108.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export default router;', '');
function preparar(datas, resumo, original, falhar = false) {
  const rotas = new Map(), chamadas = [];
  const query = async (sql, par) => {
    chamadas.push({sql, par});
    if (sql.includes('SELECT c.data_ref')) return {rows: datas.map(data => ({data}))};
    if (sql.includes(' AS m FROM cr_0108 ')) {
      if (falhar) throw new Error('banco indisponível');
      return {rows: original};
    }
    return {rows: resumo};
  };
  const ctx = vm.createContext({query, Router:()=>({get:(path,...fns)=>rotas.set(path,fns.at(-1))}),
    requireFirebaseUser:()=>{}, console:{error(){}}});
  vm.runInContext(fonte, ctx);
  return {chamadas, async executar(rota, filtros={}) {
    let status=200, body;
    const res={status(n){status=n;return this;},json(v){body=v;}};
    await rotas.get(rota)({query:{de:'2026-08-01',ate:'2026-09-05',...filtros}},res);
    return {status,body};
  }};
}
const contagem = (total) => ({total:String(total),noHorario:String(total),adiantado:'0',atrasado:'0',divergente:'0',somaDif:'0',semDif:'0'});
for (const [rota,chave,valor] of [['/serie','data','2026-09-01'],['/ranking','chave','110'],['/hora','hora','05']]) {
  test(`${rota}: dias recentes ausentes usam os registros originais`,async()=>{
    const p=preparar(['2026-09-01'],[],[{[chave]:valor,...contagem(12)}]);
    const {status,body}=await p.executar(rota);
    assert.equal(status,200);assert.equal(body.origem,'agregado+dsql');
    assert.equal(Number(body.itens[0].total),12);
    assert.match(p.chamadas[1].sql,/NOT \(data_ref = ANY/);
    assert.match(p.chamadas[2].sql,/data_ref = ANY/);
    assert.deepEqual(Array.from(p.chamadas[2].par[2]),['2026-09-01']);
  });
  test(`${rota}: resumo atualizado mantém o caminho rápido`,async()=>{
    const p=preparar([],[{[chave]:valor,...contagem(20)}],[]);
    const {body}=await p.executar(rota);
    assert.equal(body.origem,'agregado');assert.equal(p.chamadas.length,2);
  });
}
test('ranking soma dias completos e originais sem somar o resumo parcial',async()=>{
  const p=preparar(['2026-09-01'],[{chave:'110',...contagem(20)}],[{chave:'110',...contagem(12)}]);
  const {body}=await p.executar('/ranking',{linha:'110',sentido:'IDA',tipoDia:'uteis'});
  assert.equal(body.itens[0].total,32);
  assert.match(p.chamadas[0].sql,/a.total <> c.total/);
  assert.equal(p.chamadas[0].par.length,2); // cobertura não recebe filtros de dimensão
  for(const c of p.chamadas.slice(1)) {
    assert.match(c.sql,/btrim\(linha\)/);assert.match(c.sql,/btrim\(direcao\)/);
    assert.match(c.sql,/EXTRACT\(DOW/);
  }
});
test('falha no original não devolve totais parciais como sucesso',async()=>{
  const p=preparar(['2026-09-01'],[],[],true);
  const {status}=await p.executar('/serie');assert.equal(status,500);
});
test('janela sem dados continua vazia',async()=>{
  const p=preparar([],[],[]);const {body}=await p.executar('/serie');
  assert.equal(body.itens.length,0);assert.equal(body.origem,'agregado');
});
