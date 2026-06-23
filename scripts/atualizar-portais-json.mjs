import fs from "node:fs";
import path from "node:path";

const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 120000);
const portalRoot = process.env.PORTAL_ROOT || process.cwd();

const PONTUALIDADE = {
  padrao: process.env.PONTUALIDADE_PADRAO_URL
    || "https://script.google.com/macros/s/AKfycbwp-s3tzcxQl0gsm20zSfBb7Rw0bQwKnIX0hB9j_nLDIALZKvu3xeGL9G1jo-SSsXhQ9A/exec",
  alternativo: process.env.PONTUALIDADE_ALT_URL
    || "https://script.google.com/macros/s/AKfycbypfszDiFW2RTgoIvnzSYNSHALfCePOINDaFfcViFIcYqXEj3-O9NXsbs-mdRJ2I2jF/exec"
};

const AUTUACOES_URL = process.env.AUTUACOES_API_URL
  || "https://script.google.com/macros/s/AKfycbylz8scwboPQLeOKWUpw9YqKxomjts1aa8KUwodAuq5IE3T9s7RXd6GJcfMnS9qu6DI/exec";
const AUTUACOES_DATA_DE = process.env.AUTUACOES_DATA_DE || "2015-01-01";

const LIBERACAO_URL = process.env.LIBERACAO_API_URL
  || process.env.FOLHA_SERVICO_API_URL
  || "https://script.google.com/macros/s/AKfycby9hpIGulGYxlm_Oseasi_D2GIaLSvusFNqcgrSj7l7HwxcUXLTPqd8kX1JxwkCx9lqOA/exec";

const DIAS_JANELA_LANCAMENTO = Number(process.env.LIBERACAO_DIAS_JANELA || 7);

function isoDataLocal(offsetDias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoHoje() {
  return isoDataLocal(0);
}

function isoAmanha() {
  return isoDataLocal(1);
}

function isoDiasAtras(dias) {
  return isoDataLocal(-dias);
}

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status} ao acessar ${url}`);
  return response.json();
}

function escreverJson(arquivo, payload) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(payload), "utf8");
  const kb = (fs.statSync(arquivo).size / 1024).toFixed(1);
  const total = payload.total ?? payload.total_linhas ?? payload.dados?.length ?? 0;
  console.log(`  salvo ${path.basename(arquivo)} (${kb} KB, ${Number(total).toLocaleString("pt-BR")} registro(s))`);
}

async function atualizarPontualidade() {
  const dir = path.join(portalRoot, "assets", "data", "pontualidade");
  const totais = {};
  const atualizadoEm = new Date().toISOString();

  for (const [cenario, url] of Object.entries(PONTUALIDADE)) {
    console.log(`Baixando pontualidade (${cenario})...`);
    const raw = await fetchJson(url);
    const dados = Array.isArray(raw) ? raw : (raw.data || raw.dados || raw.rows || raw.valores || raw);
    const payload = {
      cenario,
      atualizadoEm,
      total: Array.isArray(dados) ? dados.length : 0,
      dados
    };
    escreverJson(path.join(dir, `${cenario}.json`), payload);
    totais[cenario] = payload.total;
  }

  escreverJson(path.join(dir, "manifest.json"), {
    atualizadoEm,
    cenarios: Object.keys(PONTUALIDADE),
    totais
  });
}

async function atualizarAutuacoes() {
  const dir = path.join(portalRoot, "assets", "data", "autuacoes");
  const dataAte = isoHoje();
  const url = `${AUTUACOES_URL}?${new URLSearchParams({ data_de: AUTUACOES_DATA_DE, data_ate: dataAte, completo: "1" })}`;
  console.log(`Baixando autuações (${AUTUACOES_DATA_DE} a ${dataAte})...`);
  const payload = await fetchJson(url);
  if (payload.status === "error") throw new Error(payload.message || "Erro na API de autuações");
  const dados = payload.data || payload.dados || [];
  const snapshot = {
    status: payload.status || "ok",
    script_versao: payload.script_versao || "",
    data_de: payload.data_de || "",
    data_ate: payload.data_ate || "",
    total: payload.total ?? dados.length,
    atualizadoEm: new Date().toISOString(),
    data: dados
  };
  escreverJson(path.join(dir, "dados.json"), snapshot);
  escreverJson(path.join(dir, "manifest.json"), {
    atualizadoEm: snapshot.atualizadoEm,
    data_de: snapshot.data_de || AUTUACOES_DATA_DE,
    data_ate: snapshot.data_ate || dataAte,
    total: snapshot.total,
    arquivo: "dados.json"
  });
}

async function buscarLiberacaoGraficos(dataDe, dataAte, timeoutMs = TIMEOUT_MS) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "graficos",
    data_de: dataDe,
    data_ate: dataAte
  })}`;
  const res = await fetchJson(url, timeoutMs);
  if (!res.ok) throw new Error(res.erro || "Falha nos gráficos de liberação");
  return {
    ok: true,
    data_de: dataDe,
    data_ate: dataAte,
    categorias: res.categorias || {},
    total_linhas: res.total_linhas || 0,
    meta: res.meta || {}
  };
}

async function buscarLiberacaoAcompanhamento(dataDe, dataAte) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "acompanhamento",
    data_de: dataDe,
    data_ate: dataAte,
    ultima_semana: "0"
  })}`;
  const res = await fetchJson(url);
  if (!res.ok) throw new Error(res.erro || "Falha no acompanhamento de liberação");
  return {
    ok: true,
    data_de: dataDe,
    data_ate: dataAte,
    dados: res.dados || [],
    meta: res.meta || {}
  };
}

async function atualizarLiberacao() {
  const dir = path.join(portalRoot, "assets", "data", "liberacao");
  const hoje = isoHoje();
  const atualizadoEm = new Date().toISOString();
  const presetsGraficos = [
    { id: "hoje", data_de: hoje, data_ate: hoje, arquivo: "graficos-hoje.json" },
    { id: "7d", data_de: isoDiasAtras(7), data_ate: hoje, arquivo: "graficos-7d.json" },
    { id: "30d", data_de: isoDiasAtras(30), data_ate: hoje, arquivo: "graficos-30d.json" }
  ];

  const graficosManifest = {};
  const timeoutGraficos = Number(process.env.LIBERACAO_GRAFICOS_TIMEOUT_MS || 0) || Math.max(TIMEOUT_MS, 300000);

  for (const preset of presetsGraficos) {
    console.log(`Baixando liberação gráficos (${preset.id}: ${preset.data_de} a ${preset.data_ate})...`);
    const timeout = preset.id === "30d" ? timeoutGraficos : TIMEOUT_MS;
    const payload = await buscarLiberacaoGraficos(preset.data_de, preset.data_ate, timeout);
    escreverJson(path.join(dir, preset.arquivo), {
      ...payload,
      atualizadoEm
    });
    graficosManifest[preset.id] = {
      arquivo: preset.arquivo,
      data_de: preset.data_de,
      data_ate: preset.data_ate,
      total_linhas: payload.total_linhas
    };
  }

  const dataDeSemana = isoDiasAtras(DIAS_JANELA_LANCAMENTO);
  const amanha = isoAmanha();
  console.log(`Baixando liberação lançamento (${dataDeSemana} a ${amanha})...`);
  const acompanhamento = await buscarLiberacaoAcompanhamento(dataDeSemana, amanha);
  escreverJson(path.join(dir, "acompanhamento-semana.json"), {
    ...acompanhamento,
    data_ate: amanha,
    atualizadoEm
  });

  const diasManifest = {};
  const porDia = {};
  (acompanhamento.dados || []).forEach((row) => {
    let iso = row.data_iso || "";
    if (!iso) {
      const br = String(row.data || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    if (!porDia[iso]) porDia[iso] = [];
    porDia[iso].push(row);
  });
  Object.keys(porDia).sort().forEach((dia) => {
    const arquivo = `acompanhamento-dia-${dia}.json`;
    escreverJson(path.join(dir, arquivo), {
      ok: true,
      data: dia,
      data_de: dia,
      data_ate: dia,
      total: porDia[dia].length,
      dados: porDia[dia],
      atualizadoEm
    });
    diasManifest[dia] = arquivo;
  });

  escreverJson(path.join(dir, "manifest.json"), {
    atualizadoEm,
    dias_janela_lancamento: DIAS_JANELA_LANCAMENTO,
    graficos: graficosManifest,
    acompanhamento: {
      arquivo: "acompanhamento-semana.json",
      data_de: dataDeSemana,
      data_ate: amanha,
      total: acompanhamento.dados.length
    },
    dias: diasManifest
  });
}

async function main() {
  console.log("Atualizando snapshots JSON (pontualidade, autuações, liberação)...");
  await atualizarPontualidade();
  await atualizarAutuacoes();
  await atualizarLiberacao();
  console.log("Concluído.");
}

main().catch((error) => {
  console.error("Falha ao atualizar snapshots:", error.message || error);
  process.exit(1);
});
