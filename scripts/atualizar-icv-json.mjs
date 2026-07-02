import fs from "node:fs";
import path from "node:path";
import {
  fetchIcvRowsFromApi,
  fetchIcvRowsFromCsv,
  ICV_API_URL,
  ICV_CSV_URL
} from "./lib/icv-parse.mjs";

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const outputDir = path.join(portalRoot, "assets", "data", "icv");
const TIMEOUT_MS = Number(process.env.ICV_TIMEOUT_MS || 120000);
const API_URL = process.env.ICV_API_URL || ICV_API_URL;
const CSV_URL = process.env.ICV_CSV_URL || ICV_CSV_URL;

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  let dados = [];
  let fonte = API_URL;

  try {
    console.log("Baixando ICV via API de pontualidade...");
    dados = await fetchIcvRowsFromApi(API_URL, TIMEOUT_MS);
  } catch (error) {
    console.warn(`  API falhou: ${error.message || error}`);
  }

  if (!dados.length) {
    try {
      console.log("Tentando planilha ICV (CSV)...");
      dados = await fetchIcvRowsFromCsv(CSV_URL, TIMEOUT_MS);
      fonte = CSV_URL.split("?")[0];
    } catch (error) {
      throw new Error(error.message || error);
    }
  }

  if (!dados.length) throw new Error("Nenhum registro ICV válido encontrado.");

  const payload = {
    atualizadoEm: new Date().toISOString(),
    total: dados.length,
    fonte,
    dados
  };
  fs.writeFileSync(path.join(outputDir, "dados.json"), JSON.stringify(payload), "utf8");
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify({
    atualizadoEm: payload.atualizadoEm,
    total: payload.total,
    arquivo: "dados.json",
    fonte
  }), "utf8");
  console.log(`ICV salvo (${dados.length} registro(s)).`);
}

main().catch((error) => {
  console.error("Falha ao atualizar ICV:", error.message || error);
  process.exit(1);
});
