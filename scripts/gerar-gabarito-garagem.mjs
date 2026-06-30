/**
 * Gera assets/js/gabarito-garagem-data.js a partir do Gabarito Garagem.xlsx
 * Uso: node scripts/gerar-gabarito-garagem.mjs [caminho.xlsx]
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const defaultXlsx =
  "/Users/odairpicolo/Library/CloudStorage/OneDrive-Pessoal/Documentos/03 - Doc. TCGL/Gabarito Garagem.xlsx";
const xlsxPath = process.argv[2] || defaultXlsx;

const wb = XLSX.readFile(xlsxPath, { cellStyles: true });
const ws = wb.Sheets["Planilha1"] || wb.Sheets[wb.SheetNames[0]];

const GRADE_ROWS = 14;
const GRADE_COLS = 74;

function cellText(r, c) {
  const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
  return v != null ? String(v).trim() : "";
}

function parseNumeroVaga(text) {
  const m = String(text).match(/(?:vaga|muro|bomba)\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function resolveHexRgb(cell) {
  const fg = cell?.s?.fgColor;
  if (!fg) return "";
  if (fg.rgb) {
    let rgb = String(fg.rgb);
    if (rgb.length === 8) rgb = rgb.slice(2);
    if (rgb.length === 6) return `#${rgb.toUpperCase()}`;
  }
  return "";
}

function corTextoCelula(cell, bg) {
  const font = cell?.s?.font?.color?.rgb;
  if (font) {
    let rgb = String(font);
    if (rgb.length === 8) rgb = rgb.slice(2);
    if (rgb.length === 6) return `#${rgb}`;
  }
  if (bg === "#000000") return "#FFFFFF";
  return "#1F2937";
}

function filaListaPorTexto(text) {
  const t = String(text || "").toUpperCase();
  if (t.includes("REFORMA")) return "reforma";
  if (t === "COT" || t.includes("COT")) return "cot";
  if (t.includes("OFICINA")) return "oficina";
  if (t.includes("LAVADOR")) return "latavador_f1";
  if (t.includes("CORUJ")) return "corujao";
  return "";
}

function coletarSlots(r, c0, c1, filaKey, skipCols = new Set()) {
  const slots = [];
  for (let c = c0; c <= c1; c += 1) {
    if (skipCols.has(c)) continue;
    const text = cellText(r, c);
    const n = parseNumeroVaga(text);
    if (n == null) continue;
    slots.push({ filaKey, slotIndex: n - 1, label: text, col: c, row: r });
  }
  return slots;
}

function registrarCapacidades(slots, cap) {
  slots.forEach((s) => {
    cap[s.filaKey] = Math.max(cap[s.filaKey] || 0, s.slotIndex + 1);
  });
}

const capacidades = {};
const allSlots = [];

for (let r = 2; r <= 6; r += 1) {
  const n = parseNumeroVaga(cellText(r, 0));
  if (n != null) allSlots.push({ filaKey: "corujao", slotIndex: n - 1, label: cellText(r, 0), row: r, col: 0 });
}

allSlots.push(...coletarSlots(1, 35, 69, "muro"));
allSlots.push(...coletarSlots(4, 23, 35, "bomba"));

for (let r = 2; r <= 7; r += 1) {
  const cor = r - 2 + 1;
  for (let c = 67; c <= 69; c += 1) {
    const n = parseNumeroVaga(cellText(r, c));
    if (n != null) {
      allSlots.push({
        filaKey: `corredor_c${cor}`,
        slotIndex: n - 1,
        label: cellText(r, c),
        row: r,
        col: c
      });
    }
  }
}

allSlots.push(...coletarSlots(8, 28, 42, "mistos_f1"));
allSlots.push(...coletarSlots(8, 46, 65, "pesados_f1"));
allSlots.push(...coletarSlots(9, 20, 26, "leves_f1"));
allSlots.push(...coletarSlots(9, 28, 42, "mistos_f2"));
allSlots.push(...coletarSlots(9, 46, 67, "pesados_f2"));
allSlots.push(...coletarSlots(10, 12, 41, "mistos_f3"));
allSlots.push(...coletarSlots(10, 46, 68, "pesados_f3"));
allSlots.push(...coletarSlots(11, 5, 41, "mistos_f4", new Set([18])));
allSlots.push(...coletarSlots(11, 46, 69, "pesados_f4"));

registrarCapacidades(allSlots, capacidades);

const porFila = {};
allSlots.forEach((s) => {
  if (!porFila[s.filaKey]) porFila[s.filaKey] = [];
  porFila[s.filaKey].push(s);
});
Object.keys(porFila).forEach((filaKey) => {
  porFila[filaKey]
    .sort((a, b) => a.col - b.col || a.row - b.row)
    .forEach((s, i) => {
      s.slotIndex = i;
      s.rotulo = s.label;
    });
  capacidades[filaKey] = porFila[filaKey].length;
});

const slotPorCelula = new Map();
allSlots.forEach((s) => {
  if (s.row != null && s.col != null) {
    slotPorCelula.set(`${s.row},${s.col}`, {
      filaKey: s.filaKey,
      slotIndex: s.slotIndex,
      rotulo: s.rotulo
    });
  }
});

function infoMerge(r, c) {
  const merges = ws["!merges"] || [];
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      return {
        master: r === m.s.r && c === m.s.c,
        colSpan: m.e.c - m.s.c + 1,
        rowSpan: m.e.r - m.s.r + 1
      };
    }
  }
  return { master: true, colSpan: 1, rowSpan: 1 };
}

const colWidths = [];
for (let c = 0; c < GRADE_COLS; c += 1) {
  const wch = ws["!cols"]?.[c]?.wch ?? 3.5;
  colWidths.push(Math.max(18, Math.round(wch * 7.2)));
}

const linhasGrade = [];
for (let r = 0; r < GRADE_ROWS; r += 1) {
  const rowH = ws["!rows"]?.[r]?.hpt ?? (r === 0 || r === 12 ? 20 : 46.5);
  const celulas = [];

  for (let c = 0; c < GRADE_COLS; c += 1) {
    const merge = infoMerge(r, c);
    if (!merge.master) continue;

    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    const text = cellText(r, c);
    let bg = resolveHexRgb(cell);
    if (!bg) {
      if (r === 0 || r === 12) bg = "#000000";
      else bg = "#FFFFFF";
    }

    const slot = slotPorCelula.get(`${r},${c}`);
    const filaLista = slot ? "" : filaListaPorTexto(text);
    const tipo = slot ? "vaga" : filaLista ? "lista" : "rotulo";

    celulas.push({
      c,
      colSpan: merge.colSpan,
      rowSpan: merge.rowSpan,
      text,
      bg,
      cor: corTextoCelula(cell, bg),
      tipo,
      filaKey: slot?.filaKey || filaLista || "",
      slotIndex: slot?.slotIndex ?? -1,
      rotulo: slot?.rotulo || text
    });
  }

  linhasGrade.push({ r, h: Math.round(rowH * 1.15), celulas });
}

const layout = {
  saidas: {
    norte: { titulo: "Norte", via: cellText(0, 0) || "Messias Wilmar de Souza", icone: "↑" },
    oeste: { titulo: "Oeste", via: "José Dias Aro", icone: "←" },
    leste: { titulo: "Leste", via: "Duque de Caxias", icone: "→" },
    sul: { titulo: "Sul", via: cellText(12, 0) || "Rua Tietê", icone: "↓" }
  },
  faixaNorte: [
    { key: "muro", label: "Muro", layout: "horizontal" },
    { key: "latavador_f1", label: "Lavador", layout: "lista" }
  ],
  oeste: [
    { key: "reforma", label: "Reforma", layout: "lista" },
    { key: "corujao", label: "Corujão", layout: "coluna" },
    { key: "cot", label: "COT", layout: "lista" },
    { key: "oficina", label: "Oficina", layout: "lista" }
  ],
  bomba: [{ key: "bomba", label: "Bomba", layout: "horizontal" }],
  linhasPatio: [
    { excelRow: 9, mistos: { key: "mistos_f1", label: "Mis. Fila 1" }, pesados: { key: "pesados_f1", label: "Pes. Fila 1" } },
    {
      excelRow: 10,
      leves: { key: "leves_f1", label: "Lev. Fila 1" },
      mistos: { key: "mistos_f2", label: "Mis. Fila 2" },
      pesados: { key: "pesados_f2", label: "Pes. Fila 2" }
    },
    { excelRow: 11, mistos: { key: "mistos_f3", label: "Mis. Fila 3" }, pesados: { key: "pesados_f3", label: "Pes. Fila 3" } },
    { excelRow: 12, mistos: { key: "mistos_f4", label: "Mis. Fila 4" }, pesados: { key: "pesados_f4", label: "Pes. Fila 4" } }
  ],
  corredor: [
    { key: "corredor_c1", label: "Cor. 1" },
    { key: "corredor_c2", label: "Cor. 2" },
    { key: "corredor_c3", label: "Cor. 3" },
    { key: "corredor_c4", label: "Cor. 4" },
    { key: "corredor_c5", label: "Cor. 5" },
    { key: "corredor_c6", label: "Cor. 6" }
  ],
  levesExtras: [
    { key: "leves_f2", label: "Lev. Fila 2" },
    { key: "leves_f3", label: "Lev. Fila 3" },
    { key: "leves_f4", label: "Lev. Fila 4" }
  ],
  legendaOrdemSaida: ["LIVRE", "2º", "3º", "4º"]
};

const ORDEM_SAIDA_POR_FILA = {
  corujao: "LIVRE",
  muro: "LIVRE",
  bomba: "LIVRE",
  latavador_f1: "LIVRE",
  cot: "LIVRE",
  corredor_c1: "LIVRE",
  corredor_c2: "LIVRE",
  corredor_c3: "LIVRE",
  corredor_c4: "LIVRE",
  corredor_c5: "LIVRE",
  corredor_c6: "LIVRE",
  pesados_f1: "LIVRE",
  pesados_f2: "2º",
  pesados_f3: "3º",
  pesados_f4: "4º",
  mistos_f1: "LIVRE",
  mistos_f2: "2º",
  mistos_f3: "3º",
  mistos_f4: "4º",
  leves_f1: "LIVRE",
  leves_f2: "2º",
  leves_f3: "3º",
  leves_f4: "4º"
};

const gabarito = {
  version: 3,
  source: path.basename(xlsxPath),
  capacidades,
  ordemSaida: ORDEM_SAIDA_POR_FILA,
  layout,
  gradeCompleta: {
    cols: GRADE_COLS,
    colWidths,
    linhas: linhasGrade
  },
  slots: allSlots
};

const outJs = `/** Gerado por scripts/gerar-gabarito-garagem.mjs — não editar manualmente */\nwindow.GABARITO_GARAGEM = ${JSON.stringify(gabarito)};\n`;
const outPath = path.join(process.cwd(), "assets/js/gabarito-garagem-data.js");
fs.writeFileSync(outPath, outJs);

console.log("Capacidades:", capacidades);
console.log("Grade:", GRADE_ROWS, "x", GRADE_COLS);
console.log("Escrito:", outPath);
