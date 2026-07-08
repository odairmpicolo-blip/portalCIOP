import fs from "node:fs";
import path from "node:path";

const APPS_SCRIPT_URL = process.env.FOLHA_SERVICO_API_URL || "";
if (!APPS_SCRIPT_URL) {
    console.warn("FOLHA_SERVICO_API_URL nao esta configurada — mantendo snapshots existentes.");
    process.exit(0);
}
const DASHBOARD_VERSAO = process.env.FOLHA_SERVICO_VERSAO || "2026-06-23-dashboard-anos-planilha";
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

function registroValido(item) {
  return Boolean(String(item?.data || "").trim());
}

function lerAnosFallback() {
  const manifestPath = path.join(outputDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return Array.isArray(manifest.anos)
      ? manifest.anos.map((item) => parseInt(String(item), 10)).filter((item) => !Number.isNaN(item) && item >= 2000)
      : [];
  } catch {
    return [];
  }
}

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
    const lote = Array.isArray(payload.dados)
      ? payload.dados.map(slimRegistro).filter(registroValido)
      : [];
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
    const lote = Array.isArray(payload.dados)
      ? payload.dados.map(slimRegistro).filter(registroValido)
      : [];
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

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log("Atualizando snapshots JSON da folha de serviço...");
  let anos = await buscarAnos();
  if (!anos.length) {
    anos = lerAnosFallback();
    if (anos.length) {
      console.warn(`API retornou anos vazios; usando manifest local: ${anos.join(", ")}`);
    }
  }
  if (!anos.length) {
    console.warn("Nenhum ano disponível. Verifique a planilha da folha de serviço (coluna data). Mantendo snapshots existentes.");
    process.exit(0);
  }

  const totais = {};
  for (const ano of anos) {
    console.log(`Baixando ano ${ano}...`);
    const payload = await buscarAno(ano);
    totais[String(ano)] = payload.total;
    if (!payload.total) {
      console.warn(`  ano ${ano}: API sem registros válidos — arquivo local preservado.`);
      continue;
    }
    escreverJson(path.join(outputDir, `ano-${ano}.json`), payload);
  }

  const totalAnos = Object.values(totais).reduce((acc, n) => acc + n, 0);
  if (!totalAnos) {
    console.warn("API retornou 0 registros válidos em todos os anos. Verifique a planilha (possível TDM desatualizado). Mantendo snapshots existentes.");
    process.exit(0);
  }

  console.log("Baixando visão consolidada (todos os anos)...");
  const todos = await buscarTodos();
  if (todos.total) {
    escreverJson(path.join(outputDir, "todos.json"), todos);
    totais.todos = todos.total;
  } else {
    console.warn("  visão todos: sem registros válidos — todos.json preservado.");
  }

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
