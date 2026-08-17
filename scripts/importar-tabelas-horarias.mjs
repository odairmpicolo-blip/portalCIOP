/**
 * Importa arquivos Excel para JSON do portal (com estilos: negrito, cores, fundo).
 * Execute: node scripts/importar-tabelas-horarias.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ExcelJS = (await import("exceljs")).default;

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const importRoot = path.join(portalRoot, "assets", "import", "tabelas-horarias");
const outputRoot = path.join(portalRoot, "assets", "data", "tabelas-horarias");
const TIPOS = ["uteis", "sabado", "domingo"];

function isoHoje() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function parseDataBr(texto) {
  const m = String(texto || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function decodeAddr(addr) {
  const m = String(addr).match(/^([A-Z]+)(\d+)$/i);
  if (!m) return { r: 0, c: 0 };
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + ch.charCodeAt(0) - 64;
  return { r: parseInt(m[2], 10) - 1, c: col - 1 };
}

function argbToHex(argb) {
  if (!argb || String(argb).length < 6) return "";
  const hex = String(argb).replace(/^FF/i, "").slice(-6).toUpperCase();
  if (hex === "000000") return "";
  return `#${hex}`;
}

function suavizarFundo(hex) {
  if (!hex) return "";
  const h = hex.toUpperCase();
  if (h === "#FFFF00" || h === "#FFFFFF00") return "#FFF8E1";
  if (h === "#FF0000") return "#FFEBEE";
  return hex;
}

function valorCelula(cell) {
  if (!cell || cell.value == null) return "";
  const v = cell.value;
  if (typeof v === "object" && v.richText) {
    return v.richText.map(t => t.text).join("").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  }
  if (typeof v === "object" && v.result != null) return valorDePrimitivo(v.result);
  if (typeof v === "object" && v.text) return String(v.text).trim();
  return valorDePrimitivo(v);
}

function valorDePrimitivo(v) {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const h = v.getHours();
    const m = v.getMinutes();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  if (typeof v === "number" && v > 0) {
    const frac = v >= 1 ? v % 1 : v;
    if (frac > 0) {
      const totalMin = Math.round(frac * 24 * 60);
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }
  return String(v).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function inferirEstiloTexto(texto, base) {
  const out = { ...(base || {}) };
  const t = String(texto || "").trim();
  if (!t) return Object.keys(out).length ? out : null;
  if (/^(via |entra no |carro do |reaproveit)/i.test(t)) {
    out.b = 1;
    out.fg = "#1565C0";
  }
  if (/^OF \d|amarelo|metros$/i.test(t) || /^\d+,\d+\s*m/i.test(t)) {
    out.b = 1;
    if (!out.fg) out.fg = "#C62828";
  }
  if (/^articulado|carre/i.test(t)) out.b = 1;
  if (/^rec\.?$/i.test(t)) out.b = 1;
  return Object.keys(out).length ? out : null;
}

function estiloCelula(cell) {
  if (!cell) return null;
  const out = {};
  if (cell.font?.bold) out.b = 1;
  const fg = argbToHex(cell.font?.color?.argb);
  const bg = suavizarFundo(argbToHex(cell.fill?.fgColor?.argb || cell.fill?.bgColor?.argb));
  if (fg) out.fg = fg;
  if (bg) out.bg = bg;
  const texto = valorCelula(cell);
  return inferirEstiloTexto(texto, out);
}

function parseMerges(ws) {
  const list = [];
  for (const range of ws.model.merges || []) {
    const [a, b] = range.split(":");
    const p0 = decodeAddr(a);
    const p1 = decodeAddr(b || a);
    list.push({
      r0: Math.min(p0.r, p1.r),
      c0: Math.min(p0.c, p1.c),
      r1: Math.max(p0.r, p1.r),
      c1: Math.max(p0.c, p1.c)
    });
  }
  return list;
}

function infoMerge(merges, r, c) {
  for (const m of merges) {
    if (r >= m.r0 && r <= m.r1 && c >= m.c0 && c <= m.c1) {
      if (r === m.r0 && c === m.c0) {
        return {
          cs: m.c1 - m.c0 + 1,
          rs: m.r1 - m.r0 + 1
        };
      }
      return { skip: true };
    }
  }
  return null;
}

async function worksheetParaMatriz(ws) {
  const rows = [];
  const estilos = [];
  let maxRow = 0;
  let maxCol = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const r = rowNumber - 1;
    maxRow = Math.max(maxRow, r);
    const rv = [];
    const sv = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const c = colNumber - 1;
      maxCol = Math.max(maxCol, c);
      rv[c] = valorCelula(cell);
      const st = estiloCelula(cell);
      if (st) sv[c] = st;
    });
    rows[r] = rv;
    if (sv.some(Boolean)) estilos[r] = sv;
  });

  for (let r = 0; r <= maxRow; r++) {
    if (!rows[r]) rows[r] = [];
    for (let c = 0; c <= maxCol; c++) {
      if (rows[r][c] === undefined) rows[r][c] = "";
    }
  }

  return { rows, estilos, merges: parseMerges(ws) };
}

function cel(v) {
  return String(v ?? "").trim();
}

function valorSignificativo(v) {
  const s = cel(v);
  return s && s !== "--:--" && s !== "|";
}

function linhaVazia(row) {
  return !(row || []).some(c => valorSignificativo(c));
}

function ehSeparadorColuna(rows, linhasCab, col) {
  return linhasCab.some(i => cel(rows[i]?.[col]) === "|");
}

function ehInicioSecaoVertical(row) {
  const texto = (row || []).map(cel).join(" ");
  return /^Carro\s+\d+/i.test(texto) && (row || []).some(c => cel(c) === "|");
}

function extrairMeta(rows) {
  const meta = {
    linha: "",
    dia_semana: "",
    data_execucao: "",
    titulo: "TABELA HORÁRIA",
    subtitulo: ""
  };
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i] || [];
    const texto = row.map(cel).join(" ").toUpperCase();
    if (!meta.linha) {
      const mLinha = texto.match(/LINHA\s*[:#]?\s*(\d{2,4})/i) || texto.match(/\bLINHA\s+(\d{2,4})\b/i);
      if (mLinha) meta.linha = mLinha[1];
    }
    if (!meta.dia_semana && /(SEGUNDA|TERÇA|QUARTA|QUINTA|SEXTA|SÁBADO|SABADO|DOMINGO)/i.test(texto)) {
      meta.dia_semana = row.map(cel).find(c => /(segunda|terça|quarta|quinta|sexta|sábado|sabado|domingo)/i.test(c)) || "";
    }
    if (!meta.data_execucao) {
      for (const cell of row) {
        const iso = parseDataBr(cell);
        if (iso) { meta.data_execucao = iso; break; }
      }
    }
  }
  return meta;
}

function acharCabecalhos(slice) {
  for (let i = 0; i < slice.length; i++) {
    const cells = (slice[i] || []).map(cel);
    const subs = cells.filter(c => /^(cheg\.?|sa[ií]da)$/i.test(c));
    if (subs.length >= 2) {
      return { idxSub: i, idxHead: Math.max(0, i - 1), idxTitulo: Math.max(0, i - 2) };
    }
  }
  for (let i = 0; i < slice.length; i++) {
    const labels = (slice[i] || []).map(cel).filter(Boolean);
    if (labels.length >= 2 && labels.some(l => /hor|viagem|sa[ií]da|chegada|in[ií]cio/i.test(l))) {
      return { idxSub: i, idxHead: i, idxTitulo: Math.max(0, i - 1) };
    }
  }
  return null;
}

function montarRotuloColuna(rows, estilos, linhasCab, col, absIni) {
  const partes = [];
  const estilo = {};
  for (const i of linhasCab) {
    const v = cel(rows[i]?.[col]);
    if (!v || v === "|") continue;
    if (!partes.includes(v)) partes.push(v);
    const st = estilos[absIni + i]?.[col];
    if (st?.b) estilo.b = 1;
    if (st?.fg) estilo.fg = st.fg;
    if (st?.bg) estilo.bg = st.bg;
  }
  return { rotulo: partes.join("\n"), estilo: Object.keys(estilo).length ? estilo : null };
}

function tituloSecao(rows, linhasCab) {
  const i = linhasCab[0];
  const rotulos = [];
  for (let c = 0; c < (rows[i] || []).length; c++) {
    if (ehSeparadorColuna(rows, linhasCab, c)) continue;
    const v = cel(rows[i]?.[c]);
    if (v && !rotulos.includes(v)) rotulos.push(v);
  }
  if (rotulos.length === 1) return rotulos[0];
  if (rotulos.length > 1) return rotulos.slice(0, 3).join(" · ");
  return "Horários";
}

function podarColunas(colunas, linhas) {
  return colunas.filter(col => linhas.some(row => valorSignificativo(row[col.chave])));
}

function extrairGrade(rows, estilos, merges, ini, fim) {
  const slice = rows.slice(ini, fim);
  const cab = acharCabecalhos(slice);
  if (!cab) return null;

  const linhasCab = [cab.idxTitulo, cab.idxHead, cab.idxSub].filter((v, i, a) => a.indexOf(v) === i);
  let maxCol = 0;
  for (const r of slice) maxCol = Math.max(maxCol, ((r || []).length || 1) - 1);

  const colunas = [];
  for (let c = 0; c <= maxCol; c++) {
    if (ehSeparadorColuna(slice, linhasCab, c)) continue;
    const { rotulo, estilo } = montarRotuloColuna(slice, estilos, linhasCab, c, ini);
    if (!rotulo) continue;
    colunas.push({
      chave: `c_${c}`,
      idx: c,
      rotulo,
      estilo,
      largura: Math.max(52, Math.min(160, rotulo.split("\n").reduce((m, l) => Math.max(m, l.length), 0) * 8 + 20)),
      alinhamento: /obs|local|ponto|terminal|via|carro|aurora|articulado/i.test(rotulo) ? "esquerda" : "centro"
    });
  }

  const linhas = [];
  for (let r = cab.idxSub + 1; r < slice.length; r++) {
    const row = slice[r] || [];
    const absR = ini + r;
    if (ehInicioSecaoVertical(row)) break;
    if (linhaVazia(row)) continue;

    const item = {};
    const estilosLinha = {};
    const mergesLinha = {};

    for (const col of colunas) {
      const mi = infoMerge(merges, absR, col.idx);
      if (mi?.skip) continue;

      const valor = cel(row[col.idx]);
      item[col.chave] = valor;

      let st = estilos[absR]?.[col.idx] || inferirEstiloTexto(valor, null);
      if (st) estilosLinha[col.chave] = st;

      if (mi?.cs > 1 || mi?.rs > 1) {
        mergesLinha[col.chave] = { cs: mi.cs || 1, rs: mi.rs || 1 };
      }
    }

    if (!colunas.some(col => valorSignificativo(item[col.chave]))) continue;
    if (Object.keys(estilosLinha).length) item.__s = estilosLinha;
    if (Object.keys(mergesLinha).length) item.__m = mergesLinha;
    linhas.push(item);
  }

  const colunasFinais = podarColunas(colunas, linhas);
  if (!colunasFinais.length) return null;

  return {
    titulo: tituloSecao(slice, linhasCab),
    colunas: colunasFinais,
    linhas
  };
}

function indicesSecoes(rows) {
  const idx = [];
  for (let i = 0; i < rows.length; i++) {
    if (ehInicioSecaoVertical(rows[i])) idx.push(i);
  }
  if (!idx.length) {
    const cab = acharCabecalhos(rows);
    if (cab) idx.push(cab.idxTitulo);
  }
  return idx;
}

function planilhaParaJson(matriz, tipo, nomeArquivo) {
  const { rows, estilos, merges } = matriz;
  const meta = extrairMeta(rows);
  if (!meta.linha) {
    const base = path.basename(nomeArquivo, path.extname(nomeArquivo));
    const m = base.match(/(\d{2,4})/);
    if (m) meta.linha = m[1];
  }
  meta.tipo = tipo;
  if (!meta.data_execucao) meta.data_execucao = isoHoje();

  const inicios = indicesSecoes(rows);
  const secoes = [];

  for (let s = 0; s < inicios.length; s++) {
    const ini = inicios[s];
    const fim = s + 1 < inicios.length ? inicios[s + 1] : rows.length;
    const grade = extrairGrade(rows, estilos, merges, ini, fim);
    if (grade && grade.linhas.length) secoes.push(grade);
  }

  if (!secoes.length) {
    const grade = extrairGrade(rows, estilos, merges, 0, rows.length);
    if (grade) secoes.push(grade);
  }

  if (secoes.length === 1) {
    return { meta, colunas: secoes[0].colunas, linhas: secoes[0].linhas, secoes };
  }
  return { meta, secoes };
}

function listarArquivos(tipo) {
  const dir = path.join(importRoot, tipo);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(xlsx|xls)$/i.test(f)).map(f => path.join(dir, f));
}

async function main() {
  if (!fs.existsSync(importRoot)) {
    console.log("Pastas de importação não encontradas. Rode: python scripts/baixar-tabelas-horarias-drive.py --local");
    return;
  }

  const tabelasDir = path.join(outputRoot, "tabelas");
  fs.mkdirSync(tabelasDir, { recursive: true });

  const manifest = {
    versao: "2026-06-23-tabelas-v3",
    atualizadoEm: new Date().toISOString(),
    drivePastaId: "1TKryDACuyao1v2wE9GGSM0rws2oOnQu5",
    tipos: {
      uteis: { rotulo: "Dias úteis", total: 84 },
      sabado: { rotulo: "Sábado", total: 70 },
      domingo: { rotulo: "Domingo", total: 57 }
    },
    tabelas: []
  };

  const vistos = new Set();
  let ordem = 0;

  for (const tipo of TIPOS) {
    const arquivos = listarArquivos(tipo);
    console.log(`${tipo}: ${arquivos.length} arquivo(s)`);
    for (const arquivo of arquivos) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(arquivo);
      const ws = wb.worksheets[0];
      const matriz = await worksheetParaMatriz(ws);
      const payload = planilhaParaJson(matriz, tipo, arquivo);
      const linha = payload.meta.linha || path.basename(arquivo).replace(/\D/g, "") || String(ordem + 1);
      const id = `${linha}-${tipo}`;
      payload.id = id;
      const rel = `tabelas/${id}.json`;
      fs.writeFileSync(path.join(outputRoot, rel), JSON.stringify(payload));
      if (!vistos.has(id)) {
        vistos.add(id);
        manifest.tabelas.push({
          id,
          tipo,
          linha: String(linha),
          titulo: `LINHA ${linha}`,
          arquivo: rel,
          ordem: ++ordem
        });
      }
      const qtd = payload.secoes?.length || 1;
      const linhas = payload.secoes?.reduce((n, s) => n + s.linhas.length, 0) || payload.linhas?.length || 0;
      console.log(`  -> ${rel} (${qtd} seção(ões), ${linhas} linhas)`);
    }
  }

  fs.writeFileSync(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Manifest atualizado com ${manifest.tabelas.length} tabela(s).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
