/**
 * Gera assets/js/frota-patio-data.js com cor, tecnologia e climatização.
 * Uso: node scripts/migrate-frota-classificacao.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets/js/frota-patio-data.js");

const CORES = ["amarelo", "azul", "verde", "vermelho", "branco", "laranja", "roxo"];

const TIPO_MAP = {
  pesado: "Pesado",
  leve: "Leve",
  minionibus: "Minionibus",
  "low entry": "Minionibus",
  articulado: "Articulado",
  arsticulado: "Articulado",
  brt: "BRT",
  "mini especial": "Mini Especial",
  "leve especial": "Leve Especial",
  "van especial": "Van Especial"
};

/** Ajustes pontuais (prefixo → campos). */
const OVERRIDES = {
  "4609": { cor: "Azul", tecnologia: "Minionibus", climatizacao: "Com AR" }
};

function titulo(palavra) {
  if (!palavra) return "";
  const p = String(palavra).trim();
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function normalizar(txt) {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatarRotulo({ cor, tecnologia, climatizacao }) {
  return [cor, tecnologia, climatizacao].filter(Boolean).join(" · ");
}

function classificarLegado(veiculo, rotuloLegado) {
  const override = OVERRIDES[String(veiculo)];
  if (override) {
    return {
      cor: override.cor || "",
      tecnologia: override.tecnologia || "",
      climatizacao: override.climatizacao || "",
      rotulo: formatarRotulo(override)
    };
  }

  const norm = normalizar(rotuloLegado);
  let cor = "";
  for (const c of CORES) {
    if (norm === c || norm.startsWith(`${c} `)) {
      cor = titulo(c);
      break;
    }
  }

  let climatizacao = "";
  if (cor || norm.includes("pesado") || norm.includes("leve")) {
    climatizacao = norm.includes("com ar") ? "Com AR" : "Sem AR";
  }

  let corpo = norm;
  if (cor) corpo = corpo.slice(cor.length).trim();
  corpo = corpo.replace(/\s*com\s*ar\s*/g, "").trim();

  let tecnologia = TIPO_MAP[corpo] || titulo(corpo);

  if (norm === "minionibus") {
    cor = cor || "Amarelo";
    tecnologia = "Minionibus";
    climatizacao = climatizacao || "Sem AR";
  }

  if (norm === "low entry") {
    cor = cor || "Amarelo";
    tecnologia = "Minionibus";
    climatizacao = climatizacao || "Sem AR";
  }

  if (["articulado", "arsticulado", "brt"].includes(corpo)) {
    climatizacao = "";
  }

  if (corpo.includes("especial")) {
    climatizacao = "";
    cor = "";
  }

  const item = { cor, tecnologia, climatizacao };
  item.rotulo = formatarRotulo(item);
  return item;
}

function lerFrotaAtual() {
  const raw = fs.readFileSync(SRC, "utf8");
  const match = raw.match(/window\.FROTA_PATIO\s*=\s*(\[[\s\S]*\])\s*;?/);
  if (!match) throw new Error("Não foi possível ler FROTA_PATIO");
  const frota = JSON.parse(match[1]);
  return frota.map((row) => {
    const legado = row.rotulo || row.tecnologia || "";
    const classif = classificarLegado(row.veiculo, legado);
    return {
      veiculo: String(row.veiculo),
      cor: classif.cor,
      tecnologia: classif.tecnologia,
      climatizacao: classif.climatizacao,
      rotulo: classif.rotulo
    };
  });
}

function main() {
  const frota = lerFrotaAtual();
  const out = `window.FROTA_PATIO = ${JSON.stringify(frota)};\n`;
  fs.writeFileSync(SRC, out, "utf8");
  console.log(`Frota migrada: ${frota.length} veículos → ${SRC}`);
  const amostra = ["1156", "4610", "3042", "4504", "4609"];
  amostra.forEach((v) => {
    const item = frota.find((f) => f.veiculo === v);
    console.log(`  ${v}:`, item?.rotulo);
  });
}

main();
