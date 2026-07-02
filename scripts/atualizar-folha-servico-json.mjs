import fs from "node:fs";
import path from "node:path";

const APPS_SCRIPT_URL = process.env.FOLHA_SERVICO_API_URL
  || "https://script.google.com/macros/s/AKfycby9hpIGulGYxlm_Oseasi_D2GIaLSvusFNqcgrSj7l7HwxcUXLTPqd8kX1JxwkCx9lqOA/exec";
const DASHBOARD_VERSAO = process.env.FOLHA_SERVICO_VERSAO || "2026-07-02-dashboard-marco-zero";
const PAGE_SIZE = Number(process.env.FOLHA_SERVICO_PAGINA || 3500);
const TIMEOUT_MS = Number(process.env.FOLHA_SERVICO_TIMEOUT_MS || 120000);
const FETCH_RETRIES = Number(process.env.FOLHA_SERVICO_RETRIES || 5);
const RETRY_DELAY_MS = Number(process.env.FOLHA_SERVICO_RETRY_DELAY_MS || 8000);
const ANOS_EXTRA = String(process.env.FOLHA_SERVICO_ANOS || "")
  .split(",")
  .map((item) => parseInt(item.trim(), 10))
  .filter((item) => !Number.isNaN(item) && item >= 2000);

const portalRoot = process.env.PORTAL_ROOT || process.cwd();
const outputDir = path.join(portalRoot, "assets", "data", "folha-servico");

function slimRegistro(item) {
  const pick = (...keys) => {
    for (const key of keys) {
      const val = item?.[key];
      if (val != null && String(val).trim() !== "") return String(val).trim();
    }
    return "";
  };
  const row = item?._row != null ? Number(item._row) : null;
  return {
    _row: row && row >= 2 ? row : null,
    data: pick("data"),
    hora: pick("hora"),
    ocorrencia: pick("ocorrencia"),
    analista: pick("analista"),
    carro_que_sai: pick("carro_que_sai", "carro_sai", "carro"),
    mot_que_sai: pick("mot_que_sai", "mot_sai", "motorista"),
    motivo_somente_oficina: pick("motivo_somente_oficina", "motivo_oficina"),
    linha: pick("linha"),
    situacao: pick("situacao")
  };
}

async function fetchJson(url) {
  let lastError;
  for (let tentativa = 1; tentativa <= FETCH_RETRIES; tentativa++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao acessar ${url}`);
      }
      const text = await response.text();
      if (/^\s*</.test(text)) {
        throw new Error("Apps Script retornou HTML. Verifique o deploy do Web App da folha de serviço.");
      }
      const payload = JSON.parse(text);
      if (payload?.ok === false) throw new Error(payload.erro || "Resposta inválida da API");
      return payload;
    } catch (error) {
      lastError = error;
      if (tentativa < FETCH_RETRIES) {
        console.warn(`  tentativa ${tentativa}/${FETCH_RETRIES} falhou: ${error.message || error}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

async function buscarAnos() {
  const payload = await fetchJson(`${APPS_SCRIPT_URL}?dashboard=1&anos=1`);
  const anos = Array.isArray(payload.anos)
    ? payload.anos.map((item) => parseInt(String(item), 10)).filter((item) => !Number.isNaN(item) && item >= 2000)
    : [];
  return [...new Set([...anos, ...ANOS_EXTRA])].sort((a, b) => b - a);
}

async function buscarAno(ano) {
  let cursor = 0;
  let dados = [];
  let meta = {};

  while (true) {
    let url = `${APPS_SCRIPT_URL}?dashboard=1&limit=${PAGE_SIZE}&ano=${encodeURIComponent(String(ano))}`;
    if (cursor > 0) url += `&from_row=${cursor}`;
    const payload = await fetchJson(url);
    meta = payload.meta || meta;
    const lote = Array.isArray(payload.dados) ? payload.dados.map(slimRegistro) : [];
    dados = dados.concat(lote);
    console.log(`  ano ${ano}: ${dados.length.toLocaleString("pt-BR")} registro(s)...`);
    if (!meta.has_more) break;
    cursor = meta.next_from_row;
    if (!cursor || !lote.length) break;
  }

  return {
    ano,
    versao: DASHBOARD_VERSAO,
    atualizadoEm: new Date().toISOString(),
    total: dados.length,
    total_planilha: meta.total_planilha || dados.length,
    dados
  };
}

async function buscarTodos() {
  let offset = 0;
  let dados = [];
  let meta = {};

  while (true) {
    const url = `${APPS_SCRIPT_URL}?dashboard=1&limit=${PAGE_SIZE}&ano=todos&completo=1&dias=0&offset=${offset}`;
    const payload = await fetchJson(url);
    meta = payload.meta || meta;
    const lote = Array.isArray(payload.dados) ? payload.dados.map(slimRegistro) : [];
    dados = dados.concat(lote);
    console.log(`  todos: ${dados.length.toLocaleString("pt-BR")} registro(s)...`);
    if (!meta.has_more) break;
    offset = meta.next_offset != null ? meta.next_offset : offset + lote.length;
    if (!lote.length) break;
  }

  return {
    ano: "todos",
    versao: DASHBOARD_VERSAO,
    atualizadoEm: new Date().toISOString(),
    total: dados.length,
    total_planilha: meta.total_planilha || dados.length,
    dados
  };
}

function escreverJson(arquivo, payload) {
  fs.writeFileSync(arquivo, JSON.stringify(payload), "utf8");
  const kb = (fs.statSync(arquivo).size / 1024).toFixed(1);
  console.log(`  salvo ${path.basename(arquivo)} (${kb} KB, ${payload.total?.toLocaleString("pt-BR") || 0} registros)`);
}

function limparSnapshotsDeAnos() {
  if (!fs.existsSync(outputDir)) return;
  for (const nome of fs.readdirSync(outputDir)) {
    if (/^ano-\d{4}\.json$/.test(nome)) {
      fs.unlinkSync(path.join(outputDir, nome));
      console.log(`  removido ${nome} (planilha sem anos)`);
    }
  }
}

function escreverMarcoZero(motivo) {
  const atualizadoEm = new Date().toISOString();
  limparSnapshotsDeAnos();
  escreverJson(path.join(outputDir, "todos.json"), {
    ano: "todos",
    versao: DASHBOARD_VERSAO,
    atualizadoEm,
    total: 0,
    total_planilha: 0,
    dados: []
  });
  escreverJson(path.join(outputDir, "manifest.json"), {
    versao: DASHBOARD_VERSAO,
    atualizadoEm,
    anos: [],
    totais: { todos: 0 },
    marco_zero: true,
    motivo
  });
  console.warn("Folha de serviço sem anos/dados. Snapshot vazio gerado como marco zero.");
}

function lerManifestExistente() {
  const arquivo = path.join(outputDir, "manifest.json");
  try {
    if (!fs.existsSync(arquivo)) return null;
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch (error) {
    console.warn(`  aviso: manifest existente invalido: ${error.message || error}`);
    return null;
  }
}

function anosDoManifestExistente() {
  const manifest = lerManifestExistente();
  return Array.isArray(manifest?.anos)
    ? manifest.anos.map((item) => parseInt(String(item), 10)).filter((item) => !Number.isNaN(item) && item >= 2000)
    : [];
}

function existeSnapshotAtual() {
  return Boolean(lerManifestExistente()) || fs.existsSync(path.join(outputDir, "todos.json"));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log("Atualizando snapshots JSON da folha de serviço...");
  let anos = [];
  try {
    anos = await buscarAnos();
  } catch (error) {
    const anosExistentes = anosDoManifestExistente();
    if (existeSnapshotAtual()) {
      console.warn(
        "Aviso: falha ao listar anos da folha (" + (error.message || error) + "). " +
        (
          anosExistentes.length
            ? "Mantendo snapshots existentes: " + anosExistentes.join(", ") + "."
            : "Mantendo snapshot atual."
        )
      );
      return;
    }
    throw error;
  }
  if (!anos.length) {
    escreverMarcoZero("API da folha retornou zero anos");
    return;
  }

  const totais = {};
  for (const ano of anos) {
    console.log(`Baixando ano ${ano}...`);
    const payload = await buscarAno(ano);
    escreverJson(path.join(outputDir, `ano-${ano}.json`), payload);
    totais[String(ano)] = payload.total;
  }

  console.log("Baixando visão consolidada (todos os anos)...");
  const todos = await buscarTodos();
  escreverJson(path.join(outputDir, "todos.json"), todos);
  totais.todos = todos.total;

  const manifest = {
    versao: DASHBOARD_VERSAO,
    atualizadoEm: new Date().toISOString(),
    anos,
    totais
  };
  escreverJson(path.join(outputDir, "manifest.json"), manifest);
  console.log("Concluído.");
}

main().catch((error) => {
  console.error("Falha ao atualizar folha de serviço:", error.message || error);
  process.exit(1);
});
