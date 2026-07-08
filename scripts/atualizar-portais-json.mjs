import fs from "node:fs";
import path from "node:path";

const TIMEOUT_MS = Number(process.env.PORTAL_JSON_TIMEOUT_MS || 120000);
const FETCH_RETRIES = Number(process.env.PORTAL_JSON_RETRIES || 4);
const RETRY_DELAY_MS = Number(process.env.PORTAL_JSON_RETRY_DELAY_MS || 6000);
const portalRoot = process.env.PORTAL_ROOT || process.cwd();

const PONTUALIDADE = {
    padrao: process.env.PONTUALIDADE_PADRAO_URL || "",
    alternativo: process.env.PONTUALIDADE_ALT_URL || ""
};

const AUTUACOES_URL = process.env.AUTUACOES_API_URL || "";
const AUTUACOES_DATA_DE = process.env.AUTUACOES_DATA_DE || "2015-01-01";

const LIBERACAO_URL = process.env.LIBERACAO_API_URL || process.env.FOLHA_SERVICO_API_URL || "";

const ESCALA_SAIDA_URL = process.env.ESCALA_SAIDA_API_URL || "";

const DIAS_JANELA_LANCAMENTO = Number(process.env.LIBERACAO_DIAS_JANELA || 7);
const PORTAL_TZ = process.env.PORTAL_TZ || "America/Sao_Paulo";

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

async function fetchJson(url, timeoutMs = TIMEOUT_MS) {
  let lastError;
  for (let tentativa = 1; tentativa <= FETCH_RETRIES; tentativa++) {
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
      if (tentativa < FETCH_RETRIES) {
        console.warn(`  tentativa ${tentativa}/${FETCH_RETRIES} falhou: ${error.message || error}`);
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
    if (!PONTUALIDADE.padrao && !PONTUALIDADE.alternativo) {
          console.warn("PONTUALIDADE_PADRAO_URL e PONTUALIDADE_ALT_URL nao configuradas — pulando pontualidade.");
          return;
    }
  const dir = path.join(portalRoot, "assets", "data", "pontualidade");
  const totais = {};
  const atualizadoEm = new Date().toISOString();

  for (const [cenario, url] of Object.entries(PONTUALIDADE)) {
        if (!url) continue;
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
    if (!AUTUACOES_URL) {
          console.warn("AUTUACOES_API_URL nao configurada — pulando autuacoes.");
          return;
    }
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

async function buscarLiberacaoDia(data, timeoutMs = TIMEOUT_MS) {
  const url = `${LIBERACAO_URL}?${new URLSearchParams({
    liberacao: "1",
    recurso: "acompanhamento",
    data,
    limit: "0",
    vivo: "1",
    _: String(Date.now())
  })}`;
  const res = await fetchJson(url, timeoutMs);
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
  const resultados = await Promise.allSettled(
    bases.map(({ url, params }) => fetchJson(`${url}?${new URLSearchParams(params)}`, timeoutMs))
  );
  let melhor = null;
  for (const r of resultados) {
    if (r.status !== "fulfilled" || !r.value.ok) continue;
    const total = (r.value.dados || []).length;
    if (!melhor || total > (melhor.dados || []).length) {
      melhor = r.value;
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
    if (!ESCALA_SAIDA_URL && !LIBERACAO_URL) {
          console.warn("ESCALA_SAIDA_API_URL e LIBERACAO_API_URL nao configuradas — pulando escala de saida.");
          return;
    }
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
    if (!LIBERACAO_URL) {
          console.warn("LIBERACAO_API_URL nao configurada — pulando liberacao (hoje).");
          return;
    }
  const dir = path.join(portalRoot, "assets", "data", "liberacao");
  const hoje = isoHoje();
  const atualizadoEm = new Date().toISOString();
  const arquivo = `acompanhamento-dia-${hoje}.json`;

  console.log(`Baixando liberação hoje (${hoje})...`);
  const payload = await buscarLiberacaoDia(hoje);
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
    if (!LIBERACAO_URL) {
          console.warn("LIBERACAO_API_URL nao configurada — pulando liberacao.");
          return;
    }
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
