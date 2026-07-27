import fs from "node:fs";
import path from "node:path";

const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 120000);
const FETCH_RETRIES = Number(process.env.PORTAL_JSON_RETRIES || 4);
const RETRY_DELAY_MS = Number(process.env.PORTAL_JSON_RETRY_DELAY_MS || 6000);
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

const ESCALA_SAIDA_URL = process.env.ESCALA_SAIDA_API_URL
  || "https://script.google.com/macros/s/AKfycbzhuM5h2MzGXnfHb4WmLZb3ZOrmXpGKOdtT0fiCazRV0yPJ5dlcchtlLThiagLcg8P4/exec";

const DIAS_JANELA_LANCAMENTO = Number(process.env.LIBERACAO_DIAS_JANELA || 7);
const PORTAL_TZ = process.env.PORTAL_TZ || "America/Sao_Paulo";

// Timeout generoso para TODAS as chamadas de liberação (hoje, gráficos, semana/lançamento):
// o backend (Apps Script, scripts/liberacao-acompanhamento.gs) pode varrer a aba por até ~4
// minutos (trava LIBERACAO_MAX_MS_VARREDURA) antes de desistir da varredura. Se o timeout aqui
// do lado do Node for menor que isso (era 120s, o padrão de TIMEOUT_MS), o Node desiste e tenta
// de novo ANTES do Apps Script terminar — o dado real nunca chega a ser salvo, mesmo quando a
// varredura no backend teria funcionado. Por isso usamos um teto próprio, maior que os 4 minutos
// do backend, com folga para latência de rede.
const LIBERACAO_TIMEOUT_MS = Number(process.env.LIBERACAO_TIMEOUT_MS || 0) || 270000; // 4,5 minutos
// As chamadas de liberação usam só 1 tentativa (sem retry): o timeout acima já é maior que o
// teto do backend, então se mesmo assim estourar, tentar de novo custaria outros ~4,5 minutos
// para o mesmo resultado — e o workflow "hoje" roda a cada 1 minuto com limite de 10 minutos de
// job, então múltiplas tentativas longas poderiam estourar esse limite sem necessidade.
const LIBERACAO_RETRIES = 1;

function partesDataPortal(data = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(data);
  const get = (tipo) => partes.find((p) => p.type === tipo)?.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day"))
  };
}

function isoDataLocal(offsetDias = 0) {
  const { year, month, day } = partesDataPortal(new Date());
  const d = new Date(Date.UTC(year, month - 1, day + offsetDias));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
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

async function fetchJson(url, timeoutMs = TIMEOUT_MS, retries = FETCH_RETRIES) {
  let lastError;
  for (let tentativa = 1; tentativa <= retries; tentativa++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ao acessar ${url}`);
      }
      const text = await response.text();
      if (/^\s*</.test(text)) {
        throw new Error("Apps Script retornou HTML em vez de JSON.");
      }
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      if (tentativa < retries) {
        console.warn(`  tentativa ${tentativa}/${retries} falhou: ${error.message || error}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
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

async function buscarLiberacaoGraficos(dataDe, dataAte, timeoutMs = LIBERACAO_TIMEOUT_MS) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "graficos",
    data_de: dataDe,
    data_ate: dataAte
  })}`;
  const res = await fetchJson(url, timeoutMs, LIBERACAO_RETRIES);
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

async function buscarLiberacaoAcompanhamento(dataDe, dataAte, timeoutMs = LIBERACAO_TIMEOUT_MS) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "acompanhamento",
    data_de: dataDe,
    data_ate: dataAte,
    ultima_semana: "0"
  })}`;
  const res = await fetchJson(url, timeoutMs, LIBERACAO_RETRIES);
  if (!res.ok) throw new Error(res.erro || "Falha no acompanhamento de liberação");
  return {
    ok: true,
    data_de: dataDe,
    data_ate: dataAte,
    dados: res.dados || [],
    meta: res.meta || {}
  };
}

async function buscarLiberacaoDia(data, timeoutMs = LIBERACAO_TIMEOUT_MS) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "acompanhamento",
    data,
    limit: "0",
    vivo: "1",
    _: String(Date.now())
  })}`;
  const res = await fetchJson(url, timeoutMs, LIBERACAO_RETRIES);
  if (!res.ok) throw new Error(res.erro || "Falha no acompanhamento do dia");
  return {
    ok: true,
    data,
    data_de: data,
    data_ate: data,
    dados: res.dados || [],
    meta: res.meta || {}
  };
}

async function buscarEscalaSaidaDia(data, timeoutMs = TIMEOUT_MS) {
  const bases = [
    { url: ESCALA_SAIDA_URL, params: { recurso: "saida_carros", data } },
    { url: ESCALA_SAIDA_URL, params: { recurso: "saida_carros", data, ignorar_data: "1" } },
    { url: LIBERACAO_URL, params: { liberacao: "1", recurso: "saida_carros", data } },
    { url: LIBERACAO_URL, params: { liberacao: "1", recurso: "saida_carros", data, ignorar_data: "1" } }
  ];
  let melhor = null;
  for (const { url, params } of bases) {
    try {
      const res = await fetchJson(`${url}?${new URLSearchParams(params)}`, timeoutMs);
      if (!res.ok) continue;
      const total = (res.dados || []).length;
      if (!melhor || total > (melhor.dados || []).length) {
        melhor = res;
      }
      if (total > 0) break;
    } catch (_) {
      /* tenta próxima fonte */
    }
  }
  if (!melhor) throw new Error(`Falha ao baixar escala de saída (${data})`);
  return {
    ok: true,
    data,
    dados: melhor.dados || [],
    colunas: melhor.colunas || [],
    meta: melhor.meta || {},
    total: (melhor.dados || []).length
  };
}

async function atualizarEscalaSaida() {
  const dir = path.join(portalRoot, "assets", "data", "escala-saida");
  const hoje = isoHoje();
  const amanha = isoAmanha();
  const atualizadoEm = new Date().toISOString();
  const dias = [hoje, amanha];
  const manifest = { atualizadoEm, dias: {} };

  for (const dia of dias) {
    console.log(`Baixando escala saída (${dia})...`);
    const payload = await buscarEscalaSaidaDia(dia);
    payload.atualizadoEm = atualizadoEm;
    const arquivo = `escala-${dia}.json`;
    escreverJson(path.join(dir, arquivo), payload);
    manifest.dias[dia] = arquivo;
  }

  escreverJson(path.join(dir, "manifest.json"), manifest);
}

async function atualizarLiberacaoSomenteHoje() {
  const dir = path.join(portalRoot, "assets", "data", "liberacao");
  const hoje = isoHoje();
  const atualizadoEm = new Date().toISOString();
  const arquivo = `acompanhamento-dia-${hoje}.json`;

  console.log(`Baixando liberação hoje (${hoje})...`);
  const payload = await buscarLiberacaoDia(hoje, LIBERACAO_TIMEOUT_MS);
  escreverJson(path.join(dir, arquivo), {
    ...payload,
    total: payload.dados.length,
    atualizadoEm
  });

  const manifestPath = path.join(dir, "manifest.json");
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (_) {
    /* manifest ausente — recriado abaixo */
  }
  manifest.atualizadoEm = atualizadoEm;
  manifest.dias = manifest.dias || {};
  manifest.dias[hoje] = arquivo;
  escreverJson(manifestPath, manifest);
}

async function atualizarLiberacao() {
  const dir = path.join(portalRoot, "assets", "data", "liberacao");
  const hoje = isoHoje();
  const atualizadoEm = new Date().toISOString();

  const manifestPath = path.join(dir, "manifest.json");
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (_) {
    /* manifest ausente — recriado ao longo desta função */
  }
  manifest.graficos = manifest.graficos || {};
  manifest.dias = manifest.dias || {};

  // 1) PRIORIDADE: garante o dado de HOJE primeiro (e já salva o arquivo/manifest), antes de
  //    gastar tempo com os outros dias. Assim, mesmo que os passos seguintes (7d/30d/semana)
  //    demorem ou falhem nesta execução, o dado de hoje — o mais crítico para o painel/lançamento
  //    — já está garantido e salvo.
  console.log(`Baixando liberação hoje (prioridade: ${hoje})...`);
  try {
    const hojePayload = await buscarLiberacaoDia(hoje, LIBERACAO_TIMEOUT_MS);
    const arquivoHoje = `acompanhamento-dia-${hoje}.json`;
    escreverJson(path.join(dir, arquivoHoje), {
      ...hojePayload,
      total: hojePayload.dados.length,
      atualizadoEm
    });
    manifest.dias[hoje] = arquivoHoje;
    manifest.atualizadoEm = atualizadoEm;
    escreverJson(manifestPath, manifest);
  } catch (error) {
    console.warn(`  aviso: falha ao priorizar hoje (${error.message || error}) — segue para os outros dias.`);
  }

  // 2) Com hoje já garantido, processa os gráficos (hoje/7d/30d) e a janela de dias anteriores
  //    ("outros dias"), com mais tempo — mesmo timeout generoso (LIBERACAO_TIMEOUT_MS), já que
  //    não bloqueiam mais a prioridade acima.
  const presetsGraficos = [
    { id: "hoje", data_de: hoje, data_ate: hoje, arquivo: "graficos-hoje.json" },
    { id: "7d", data_de: isoDiasAtras(7), data_ate: hoje, arquivo: "graficos-7d.json" },
    { id: "30d", data_de: isoDiasAtras(30), data_ate: hoje, arquivo: "graficos-30d.json" }
  ];

  const graficosManifest = manifest.graficos;
  for (const preset of presetsGraficos) {
    console.log(`Baixando liberação gráficos (${preset.id}: ${preset.data_de} a ${preset.data_ate})...`);
    const payload = await buscarLiberacaoGraficos(preset.data_de, preset.data_ate, LIBERACAO_TIMEOUT_MS);
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
  const acompanhamento = await buscarLiberacaoAcompanhamento(dataDeSemana, amanha, LIBERACAO_TIMEOUT_MS);
  escreverJson(path.join(dir, "acompanhamento-semana.json"), {
    ...acompanhamento,
    data_ate: amanha,
    atualizadoEm
  });

  const diasManifest = manifest.dias;
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

  escreverJson(manifestPath, {
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
  const modo = process.argv[2];
  if (modo === "--escala-saida") {
    console.log("Atualizando JSON de escala saída...");
    await atualizarEscalaSaida();
    console.log("Concluído.");
    return;
  }
  if (modo === "--liberacao-hoje") {
    console.log("Atualizando JSON de liberação (hoje)...");
    await atualizarLiberacaoSomenteHoje();
    console.log("Concluído.");
    return;
  }
  console.log("Atualizando snapshots JSON (pontualidade, autuações, liberação, escala saída)...");
  await atualizarPontualidade();
  await atualizarAutuacoes();
  await atualizarLiberacao();
  await atualizarEscalaSaida();
  console.log("Concluído.");
}

main().catch((error) => {
  console.error("Falha ao atualizar snapshots:", error.message || error);
  process.exit(1);
});
