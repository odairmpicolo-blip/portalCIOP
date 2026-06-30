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

const wb = XLSX.readFile(xlsxPath);
const ws = wb.Sheets["Planilha1"] || wb.Sheets[wb.SheetNames[0]];

function cellText(r, c) {
  const v = ws[XLSX.utils.encode_cell({ r, c })]?.v;
  return v != null ? String(v).trim() : "";
}

function parseNumeroVaga(text) {
  const m = String(text).match(/(?:vaga|muro|bomba)\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function coletarSlots(r, c0, c1, filaKey, skipCols = new Set()) {
  const slots = [];
  for (let c = c0; c <= c1; c += 1) {
    if (skipCols.has(c)) continue;
    const text = cellText(r, c);
    const n = parseNumeroVaga(text);
    if (n == null) continue;
    slots.push({ filaKey, slotIndex: n - 1, label: text, col: c });
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

// Corujão — col A, linhas 3–7 (índice r 2–6)
for (let r = 2; r <= 6; r += 1) {
  const n = parseNumeroVaga(cellText(r, 0));
  if (n != null) allSlots.push({ filaKey: "corujao", slotIndex: n - 1, label: cellText(r, 0), row: r, col: 0 });
}

// Muro — linha 2, cols AJ–BR (MURO 35 … MURO 1)
allSlots.push(...coletarSlots(1, 35, 69, "muro"));

// Bomba — linha 5, cols X–AJ
allSlots.push(...coletarSlots(4, 23, 35, "bomba"));

// Corredor — cols BP–BR, linhas 3–8
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

// Linha 9 — mistos F1 | pesados F1
allSlots.push(...coletarSlots(8, 28, 42, "mistos_f1"));
allSlots.push(...coletarSlots(8, 46, 65, "pesados_f1"));

// Linha 10 — leves F1 (U–AA) + mistos F2 (AC–AQ) | pesados F2
allSlots.push(...coletarSlots(9, 20, 26, "leves_f1"));
allSlots.push(...coletarSlots(9, 28, 42, "mistos_f2"));
allSlots.push(...coletarSlots(9, 46, 67, "pesados_f2"));

// Linha 11 — mistos F3 | pesados F3
allSlots.push(...coletarSlots(10, 12, 41, "mistos_f3"));
allSlots.push(...coletarSlots(10, 46, 68, "pesados_f3"));

// Linha 12 — mistos F4 (pula caixa d'água col S) | pesados F4
allSlots.push(...coletarSlots(11, 5, 41, "mistos_f4", new Set([18])));
allSlots.push(...coletarSlots(11, 46, 69, "pesados_f4"));

registrarCapacidades(allSlots, capacidades);

// Índice interno 0…n-1 na ordem das colunas; rótulo do Excel preservado em label
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
  version: 2,
  source: path.basename(xlsxPath),
  capacidades,
  ordemSaida: ORDEM_SAIDA_POR_FILA,
  layout,
  slots: allSlots
};

const outJs = `/** Gerado por scripts/gerar-gabarito-garagem.mjs — não editar manualmente */\nwindow.GABARITO_GARAGEM = ${JSON.stringify(gabarito)};\n`;
const outPath = path.join(process.cwd(), "assets/js/gabarito-garagem-data.js");
fs.writeFileSync(outPath, outJs);

console.log("Capacidades:", capacidades);
console.log("Escrito:", outPath);
