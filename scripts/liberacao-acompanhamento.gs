/**
 * Acompanhamento da Liberação — Web App (mesmo projeto do folha-servico-lancamento.gs)
 *
 * Planilha CIOP: 1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA
 *   - D.Operacionais de In.Linhas (gráficos): gid 751419807
 *   - ACOMPANHAMENTO LIBERAÇÃO (lançamentos): gid 753262285
 * Saída de carros semanal: 1F9L3b2JZPOMyEixvkTIML_UNNkvPZTZyGI4g05H4ln0 — gid 1482156234
 *
 * GET  ?liberacao=1&recurso=operacionais[&data=YYYY-MM-DD]
 * GET  ?liberacao=1&recurso=graficos&data_de=...&data_ate=...
 * GET  ?liberacao=1&recurso=acompanhamento[&data=YYYY-MM-DD][&data_de=...][&data_ate=...][&maquina=...][&limit=N][&incluir_colunas=1][&ultima_semana=0|1][&vivo=1]
 * GET  ?liberacao=1&recurso=saida_carros[&data=YYYY-MM-DD][&maquina=...]
 * GET  ?liberacao=1&recurso=comparacao&data=YYYY-MM-DD[&maquina=...]
 * GET  ?liberacao=1&recurso=resumo[&data=YYYY-MM-DD][&incluir_colunas=1]
 * POST ?liberacao=1  action=create|update|upsert  (+ campos da aba acompanhamento)
 */

const LIBERACAO_VERSAO = "2026-06-22-liberacao-perf";
const LIBERACAO_DIAS_JANELA = 7;
const LIBERACAO_CHUNK_LINHAS = 800;
const LIBERACAO_CACHE_TTL = 600;
const LIBERACAO_SPREADSHEET_ID = "1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA";
const LIBERACAO_OPERACIONAIS_GID = 751419807;
const LIBERACAO_ACOMPANHAMENTO_GID = 753262285;
const LIBERACAO_SAIDA_SPREADSHEET_ID = "1F9L3b2JZPOMyEixvkTIML_UNNkvPZTZyGI4g05H4ln0";
const LIBERACAO_SAIDA_GID = 1482156234;

function versaoCacheLiberacao_() {
  return PropertiesService.getScriptProperties().getProperty("liberacao_cache_v") || "0";
}

function invalidarCacheLiberacao_() {
  PropertiesService.getScriptProperties().setProperty("liberacao_cache_v", String(Date.now()));
}

function solicitarAtualizacaoJsonLiberacaoHoje_(origem) {
  origem = origem || "liberacao";
  try {
    if (typeof solicitarAtualizacaoJsonPortal_ === "function") {
      solicitarAtualizacaoJsonPortal_(origem);
    }
  } catch (errPortal) {}
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_PAT");
  if (!token) return;
  var repo = PropertiesService.getScriptProperties().getProperty("GITHUB_REPO") || "odairmpicolo-blip/portalCIOP";
  try {
    UrlFetchApp.fetch("https://api.github.com/repos/" + repo + "/dispatches", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      payload: JSON.stringify({
        event_type: "liberacao",
        client_payload: { origem: origem, ts: new Date().toISOString() }
      }),
      muteHttpExceptions: true
    });
  } catch (errFetch) {}
}

function cacheChaveLiberacao_(recurso, partes) {
  return "lib-" + LIBERACAO_VERSAO + "-" + versaoCacheLiberacao_() + "-" + recurso + "-" + partes.join("|");
}

function lerCacheLiberacao_(chave) {
  try {
    var raw = CacheService.getScriptCache().get(chave);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function gravarCacheLiberacao_(chave, obj) {
  try {
    CacheService.getScriptCache().put(chave, JSON.stringify(obj), LIBERACAO_CACHE_TTL);
  } catch (err) {}
}

function montarJanelaLeituraLiberacao_(dataFiltro, dataDe, dataAte, ultimaSemanaFlag) {
  if (dataFiltro) {
    return {
      ultimaSemanaOnly: false,
      dataDe: dataFiltro,
      dataAte: dataFiltro,
      dataFiltro: dataFiltro
    };
  }
  var dataDeNorm = normalizarDataIsoLiberacao_(dataDe || "");
  var dataAteNorm = normalizarDataIsoLiberacao_(dataAte || "");
  var hojeIso = isoDataDiasAtrasLiberacao_(0);

  if (!dataAteNorm) dataAteNorm = hojeIso;
  if (!dataDeNorm) {
    dataDeNorm = isoDataDiasAtrasLiberacao_(LIBERACAO_DIAS_JANELA);
  }
  if (dataDeNorm > dataAteNorm) {
    var tmp = dataDeNorm;
    dataDeNorm = dataAteNorm;
    dataAteNorm = tmp;
  }

  return {
    ultimaSemanaOnly: false,
    dataDe: dataDeNorm,
    dataAte: dataAteNorm,
    dataFiltro: dataFiltro || ""
  };
}

function montarRespostaLiberacaoGet_(params) {
  const recurso = String(params.recurso || "operacionais").toLowerCase();
  const dataFiltro = normalizarDataIsoLiberacao_(params.data || "");
  const maquinaFiltro = String(params.maquina || "").trim();

  if (recurso === "acompanhamento") {
    const limit = parseInt(params.limit || "0", 10);
    const incluirColunas = String(params.incluir_colunas || "") === "1";
    const vivo = String(params.vivo || "") === "1";
    const dataDe = normalizarDataIsoLiberacao_(params.data_de || "");
    const dataAte = normalizarDataIsoLiberacao_(params.data_ate || "");
    const ultimaSemana = String(params.ultima_semana || "1") !== "0" && !dataDe && !dataAte && !dataFiltro;
    const janela = montarJanelaLeituraLiberacao_(dataFiltro, dataDe, dataAte, ultimaSemana);
    const cacheKey = cacheChaveLiberacao_("acomp", [
      dataFiltro, janela.dataDe, janela.dataAte, maquinaFiltro, String(limit), incluirColunas ? "1" : "0"
    ]);
    if (!vivo) {
      const emCache = lerCacheLiberacao_(cacheKey);
      if (emCache) {
        emCache.meta = emCache.meta || {};
        emCache.meta.cache = true;
        return emCache;
      }
    }

    const dados = lerAcompanhamentoLiberacao_(dataFiltro, limit, maquinaFiltro, janela);
    const payload = {
      ok: true,
      dados: dados,
      meta: {
        versao: LIBERACAO_VERSAO,
        recurso: recurso,
        ultima_semana: ultimaSemana,
        data_de: janela.dataDe,
        data_ate: janela.dataAte,
        cache: false
      }
    };
    if (incluirColunas) payload.colunas = lerColunasAcompanhamento_();
    gravarCacheLiberacao_(cacheKey, payload);
    return payload;
  }
  if (recurso === "graficos") {
    const dataDe = normalizarDataIsoLiberacao_(params.data_de || "");
    const dataAte = normalizarDataIsoLiberacao_(params.data_ate || "");
    if (!dataDe || !dataAte) return { ok: false, erro: "Informe data_de e data_ate para os gráficos." };
    const cacheKey = cacheChaveLiberacao_("graficos", [dataDe, dataAte]);
    const emCache = lerCacheLiberacao_(cacheKey);
    if (emCache) {
      emCache.meta = emCache.meta || {};
      emCache.meta.cache = true;
      return emCache;
    }
    const payload = montarGraficosLiberacao_(dataDe, dataAte);
    gravarCacheLiberacao_(cacheKey, payload);
    return payload;
  }
  if (recurso === "comparacao") {
    if (!dataFiltro) return { ok: false, erro: "Informe a data (data=YYYY-MM-DD) para comparar." };
    return Object.assign(
      { ok: true, meta: { versao: LIBERACAO_VERSAO, recurso: recurso } },
      montarComparacaoLiberacao_(dataFiltro, maquinaFiltro)
    );
  }
  if (recurso === "resumo") {
    return montarResumoDashboardLiberacao_(dataFiltro, String(params.incluir_colunas || "") === "1");
  }
  if (recurso === "saida_carros") {
    const ref = resolverSaidaCarrosPorData_(dataFiltro);
    return {
      ok: true,
      dados: lerSaidaCarrosLiberacao_(dataFiltro, maquinaFiltro),
      meta: {
        versao: LIBERACAO_VERSAO,
        recurso: recurso,
        saida_ref: ref
      }
    };
  }
  return {
    ok: true,
    graficos: lerOperacionaisLiberacao_(dataFiltro),
    meta: { versao: LIBERACAO_VERSAO, recurso: "operacionais" }
  };
}

function montarRespostaLiberacaoPost_(params) {
  const action = String(params.action || "create").toLowerCase();
  if (action === "update") return atualizarAcompanhamentoLiberacao_(params);
  if (action === "upsert") return upsertAcompanhamentoLiberacao_(params);
  return criarAcompanhamentoLiberacao_(params);
}

function abrirAbaPorGid_(spreadsheetId, gid) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === gid) return sheets[i];
  }
  throw new Error("Aba gid " + gid + " não encontrada.");
}

function lerOperacionaisLiberacao_(dataFiltro) {
  const sheet = abrirAbaPorGid_(LIBERACAO_SPREADSHEET_ID, LIBERACAO_OPERACIONAIS_GID);
  const valores = sheet.getDataRange().getValues();
  const historico = [];
  let resumo = null;
  let orientacoes = [];

  for (let r = 0; r < valores.length; r++) {
    const row = valores[r];
    const c0 = String(row[0] || "").trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(c0)) {
      const item = {
        data: normalizarDataIsoLiberacao_(c0),
        data_br: c0,
        qt_saidas: parseNumeroLiberacao_(row[1]),
        no_horario: parseNumeroLiberacao_(row[2]),
        pct_no_horario: parsePercentualLiberacao_(row[3]),
        atrasado: parseNumeroLiberacao_(row[4]),
        pct_atrasado: parsePercentualLiberacao_(row[5]),
        adiantado: parseNumeroLiberacao_(row[6]),
        pct_adiantado: parsePercentualLiberacao_(row[7]),
        total_pct: parsePercentualLiberacao_(row[8])
      };
      historico.push(item);
      if (!dataFiltro || item.data === dataFiltro) resumo = item;
    }
    if (normalizarChaveLiberacao_(c0) === "base_de_dados") {
      orientacoes = parseOrientacoesOperacionais_(valores, r);
    }
  }

  if (!resumo && historico.length) {
    resumo = historico[historico.length - 1];
  }

  return {
    resumo: resumo,
    historico: historico,
    orientacoes: orientacoes,
    situacao_saida: resumo ? [
      { label: "No horário", total: resumo.no_horario, pct: resumo.pct_no_horario },
      { label: "Atrasado", total: resumo.atrasado, pct: resumo.pct_atrasado },
      { label: "Adiantado", total: resumo.adiantado, pct: resumo.pct_adiantado }
    ] : [],
    historico_pct_no_horario: historico.map(function (h) {
      return { label: h.data_br, total: h.pct_no_horario };
    })
  };
}

function parseOrientacoesOperacionais_(valores, baseRow) {
  const categorias = [];
  const header = valores[baseRow] || [];
  const sub = valores[baseRow + 1] || [];
  const inicioDados = baseRow + 3;
  const mapa = [];

  for (let c = 0; c < header.length; c++) {
    const titulo = String(header[c] || "").trim();
    if (!titulo) continue;
    const gravidade = String(sub[c] || "").trim().toUpperCase();
    if (gravidade === "MOTORISTA" || gravidade === "QTD.") continue;
    if (titulo.length > 8) {
      mapa.push({ col: c, categoria: titulo, gravidade: gravidade || "ORIENTAR" });
    }
  }

  mapa.forEach(function (info) {
    let total = 0;
    for (let r = inicioDados; r < valores.length; r++) {
      const mot = String(valores[r][info.col] || "").trim();
      const qtdCol = info.col + 1;
      const qtdRaw = valores[r][qtdCol];
      if (/^\d+$/.test(String(mot)) && mot.length >= 3) {
        total += parseNumeroLiberacao_(qtdRaw);
      }
    }
    if (total > 0) {
      categorias.push({
        label: info.categoria,
        gravidade: info.gravidade,
        total: total
      });
    }
  });

  return categorias.sort(function (a, b) { return b.total - a.total; }).slice(0, 12);
}

function lerColunasAcompanhamento_() {
  const sheet = abrirAbaPorGid_(LIBERACAO_SPREADSHEET_ID, LIBERACAO_ACOMPANHAMENTO_GID);
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  const cabecalho = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const colunas = [];
  cabecalho.forEach(function (titulo) {
    const chave = normalizarChaveLiberacao_(titulo);
    if (!chave) return;
    colunas.push({ chave: chave, rotulo: String(titulo || "").trim() });
  });
  return colunas;
}

function chaveRegistroLiberacao_(item) {
  const work = String(item.work_id || "").trim();
  if (work) return "w:" + work;
  const carro = String(item.carro || "").trim();
  const linha = String(item.linha || "").trim();
  const hora = String(
    item.horario_saida_da_garagem || item.horario_de_saida_da_garagem || item.horario_saida || ""
  ).trim();
  return "c:" + carro + "|l:" + linha + "|h:" + hora;
}

function montarComparacaoLiberacao_(dataFiltro, maquinaFiltro) {
  const colunas = lerColunasAcompanhamento_();
  const janela = montarJanelaLeituraLiberacao_(dataFiltro, "", "", false);
  const planilha = lerAcompanhamentoLiberacao_(dataFiltro, 0, maquinaFiltro, janela);
  const saida = lerSaidaCarrosLiberacao_(dataFiltro, maquinaFiltro);
  const mapPlanilha = {};
  const usados = {};
  const dados = [];

  planilha.forEach(function (p) {
    mapPlanilha[chaveRegistroLiberacao_(p)] = p;
  });

  saida.forEach(function (s) {
    const chave = chaveRegistroLiberacao_(s);
    const existente = mapPlanilha[chave];
    usados[chave] = true;
    const merged = existente ? mesclarRegistroLiberacao_(s, existente) : Object.assign({}, s);
    merged._status = existente ? "cadastrado" : "pendente";
    merged._row = existente ? existente._row : "";
    merged._chave = chave;
    merged._origem = existente ? "ambos" : "saida_carros";
    dados.push(merged);
  });

  planilha.forEach(function (p) {
    const chave = chaveRegistroLiberacao_(p);
    if (usados[chave]) return;
    const item = Object.assign({}, p);
    item._status = "somente_planilha";
    item._row = p._row;
    item._chave = chave;
    item._origem = "planilha";
    dados.push(item);
  });

  dados.sort(function (a, b) {
    const ha = String(a.horario_saida_da_garagem || a.horario_de_saida_da_garagem || a.horario_saida || "");
    const hb = String(b.horario_saida_da_garagem || b.horario_de_saida_da_garagem || b.horario_saida || "");
    return ha.localeCompare(hb, "pt-BR", { numeric: true });
  });

  const maquinas = {};
  dados.forEach(function (d) {
    const m = String(d.maquina || "").trim();
    if (m) maquinas[m] = true;
  });

  return {
    colunas: colunas,
    dados: dados,
    maquinas: Object.keys(maquinas).sort(),
    saida_ref: resolverSaidaCarrosPorData_(dataFiltro),
    resumo: {
      total_saida: saida.length,
      total_planilha: planilha.length,
      total_cadastrados: dados.filter(function (d) { return d._status === "cadastrado"; }).length,
      total_pendentes: dados.filter(function (d) { return d._status === "pendente"; }).length,
      total_somente_planilha: dados.filter(function (d) { return d._status === "somente_planilha"; }).length
    }
  };
}

function mesclarRegistroLiberacao_(saida, planilha) {
  const merged = Object.assign({}, saida);
  Object.keys(planilha).forEach(function (k) {
    if (k.charAt(0) === "_") return;
    const valor = planilha[k];
    if (valor != null && String(valor).trim() !== "") merged[k] = valor;
  });
  return merged;
}

function normalizarMaquinaLiberacao_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function filtrarMaquinaLiberacao_(item, maquinaFiltro) {
  if (!maquinaFiltro) return true;
  return normalizarMaquinaLiberacao_(item.maquina) === normalizarMaquinaLiberacao_(maquinaFiltro);
}

function resolverSaidaCarrosPorData_(dataIso) {
  return {
    spreadsheetId: LIBERACAO_SAIDA_SPREADSHEET_ID,
    gid: LIBERACAO_SAIDA_GID,
    origem: "semanal",
    data: dataIso || ""
  };
}

function abrirSaidaCarrosPorData_(dataIso) {
  return abrirAbaPorGid_(LIBERACAO_SAIDA_SPREADSHEET_ID, LIBERACAO_SAIDA_GID);
}

function isoDataDiasAtrasLiberacao_(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function lerAcompanhamentoDiaCompleto_(dataIso, limit, maquinaFiltro) {
  const sheet = abrirAbaPorGid_(LIBERACAO_SPREADSHEET_ID, LIBERACAO_ACOMPANHAMENTO_GID);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const cabecalho = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizarChaveLiberacao_);
  const dados = [];
  var endRow = lastRow;

  while (endRow >= 2) {
    const startRow = Math.max(2, endRow - LIBERACAO_CHUNK_LINHAS + 1);
    const numRows = endRow - startRow + 1;
    const valores = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var parar = false;

    for (var i = valores.length - 1; i >= 0; i--) {
      const rowNum = startRow + i;
      const item = linhaAcompanhamentoParaObjeto_(cabecalho, valores[i], rowNum);
      const iso = item.data_iso || normalizarDataIsoLiberacao_(item.data);

      if (iso && iso < dataIso) {
        parar = true;
        break;
      }
      if (iso !== dataIso) continue;
      if (!filtrarMaquinaLiberacao_(item, maquinaFiltro)) continue;
      dados.push(item);
      if (limit > 0 && dados.length >= limit) return dados;
    }

    if (parar) break;
    endRow = startRow - 1;
  }

  if (limit > 0 && dados.length > limit) dados.splice(limit);
  return dados;
}

function lerAcompanhamentoLiberacao_(dataFiltro, limit, maquinaFiltro, janelaOpts) {
  if (dataFiltro) {
    return lerAcompanhamentoDiaCompleto_(dataFiltro, limit, maquinaFiltro);
  }
  var ultimaSemanaOnly = true;
  var dataMinIso = "";
  var dataMaxIso = "";
  if (janelaOpts && typeof janelaOpts === "object") {
    ultimaSemanaOnly = janelaOpts.ultimaSemanaOnly !== false;
    dataMinIso = janelaOpts.dataDe || "";
    dataMaxIso = janelaOpts.dataAte || "";
    if (dataMinIso || dataMaxIso) ultimaSemanaOnly = false;
  } else {
    ultimaSemanaOnly = janelaOpts !== false;
  }
  if (ultimaSemanaOnly && !dataMinIso) {
    dataMinIso = isoDataDiasAtrasLiberacao_(LIBERACAO_DIAS_JANELA);
  }
  const sheet = abrirAbaPorGid_(LIBERACAO_SPREADSHEET_ID, LIBERACAO_ACOMPANHAMENTO_GID);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const cabecalho = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalizarChaveLiberacao_);
  const dados = [];
  var endRow = lastRow;

  while (endRow >= 2) {
    const startRow = Math.max(2, endRow - LIBERACAO_CHUNK_LINHAS + 1);
    const numRows = endRow - startRow + 1;
    const valores = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var parar = false;

    for (var i = valores.length - 1; i >= 0; i--) {
      const rowNum = startRow + i;
      const item = linhaAcompanhamentoParaObjeto_(cabecalho, valores[i], rowNum);
      const iso = item.data_iso || normalizarDataIsoLiberacao_(item.data);

      if (dataMinIso && iso && iso < dataMinIso) {
        parar = true;
        break;
      }
      if (dataMaxIso && iso && iso > dataMaxIso) continue;
      if (dataFiltro && iso !== dataFiltro) continue;
      if (!filtrarMaquinaLiberacao_(item, maquinaFiltro)) continue;
      dados.push(item);
    }

    if (parar) break;
    endRow = startRow - 1;
  }

  if (limit > 0 && dados.length > limit) dados.splice(limit);
  return dados;
}

function lerSaidaCarrosLiberacao_(dataFiltro, maquinaFiltro) {
  if (!dataFiltro) return [];
  var sheet;
  try {
    sheet = abrirSaidaCarrosPorData_(dataFiltro);
  } catch (err) {
    return [];
  }
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const titulos = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const cabecalho = titulos.map(normalizarChaveLiberacao_);
  const valores = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const dados = [];

  for (let i = 0; i < valores.length; i++) {
    const bruto = {};
    cabecalho.forEach(function (chave, idx) {
      if (!chave) return;
      bruto[chave] = valorCelulaLiberacao_(valores[i][idx]);
    });
    const dataBr = pickCampoLiberacao_(bruto, ["data", "dia", "data_saida", "data_dia", "dt", "date"]);
    const dataIso = normalizarDataIsoLiberacao_(dataBr);
    if (dataFiltro && dataIso !== dataFiltro) continue;
    const item = mapearSaidaCarrosParaAcompanhamento_(bruto, dataIso, dataBr);
    if (!filtrarMaquinaLiberacao_(item, maquinaFiltro)) continue;
    dados.push(item);
  }

  return dados;
}

function mapearSaidaCarrosParaAcompanhamento_(bruto, dataIso, dataBr) {
  const dataExibir = dataBr || (dataIso ? formatarDataBrLiberacao_(dataIso) : "");
  return {
    data: dataExibir,
    maquina: pickCampoLiberacao_(bruto, ["maquina", "maquina_", "maq", "equipamento"]),
    linha: pickCampoLiberacao_(bruto, ["linha", "linha_"]),
    work_id: pickCampoLiberacao_(bruto, ["work_id", "workid", "work", "id_servico"]),
    carro: pickCampoLiberacao_(bruto, ["carro", "prefixo", "veiculo", "frota"]),
    motorista: pickCampoLiberacao_(bruto, ["motorista", "matricula", "mot", "registro"]),
    preparo: pickCampoLiberacao_(bruto, ["preparo", "tempo_preparo"]),
    horario_saida_da_garagem: pickCampoLiberacao_(bruto, [
      "horario_saida_da_garagem", "horario_de_saida_da_garagem", "horario_saida", "saida_programada", "previsto", "horario"
    ]),
    saida_real: pickCampoLiberacao_(bruto, ["saida_real", "realizado", "saida_efetiva", "hora_real"]),
    local_inicio: pickCampoLiberacao_(bruto, ["local_inicio", "local", "terminal"]),
    horario_de_inicio: pickCampoLiberacao_(bruto, ["horario_de_inicio", "horario_inicio", "inicio_programado"]),
    inicio_real: pickCampoLiberacao_(bruto, ["inicio_real", "inicio_efetivo"]),
    observacoes: pickCampoLiberacao_(bruto, ["observacoes", "obs", "observacao"]),
    _origem: "saida_carros"
  };
}

function formatarDataBrLiberacao_(iso) {
  const p = String(iso || "").slice(0, 10).split("-");
  if (p.length !== 3) return iso;
  return p[2] + "/" + p[1] + "/" + p[0];
}

function formatarPctLiberacao_(valor) {
  if (!isFinite(valor)) return "0%";
  return String(Math.round(valor * 100) / 100).replace(".", ",") + "%";
}

function pctLiberacao_(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 10000) / 100;
}

function normalizarSituacaoLiberacao_(valor) {
  const t = String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  if (!t) return "";
  if (t.indexOf("ADIANT") >= 0) return "ADIANTADO";
  if (t.indexOf("ATRAS") >= 0) return "ATRASADO";
  if (t.indexOf("HOR") >= 0 || t === "SIM") return "NO_HORARIO";
  if (t === "NAO" || t === "NÃO") return "ATRASADO";
  return "";
}

function situacaoSaidaLiberacao_(row) {
  const s = normalizarSituacaoLiberacao_(row.saida_atrasado_adiantado);
  if (s) return s;
  return normalizarSituacaoLiberacao_(row.saiu_no_horario);
}

function situacaoInicioLiberacao_(row) {
  return normalizarSituacaoLiberacao_(row.inicio_no_horario);
}

function chaveCategoriaLiberacao_(saida, inicio) {
  return String(saida || "") + "|" + String(inicio || "");
}

var CATEGORIAS_BASE_DADOS_ = [
  { chave: "NO_HORARIO|ATRASADO", titulo: "SAIU NO HORÁRIO E INICIOU ATRASADO", gravidade: "ORIENTAR" },
  { chave: "NO_HORARIO|ADIANTADO", titulo: "SAIU NO HORÁRIO E INICIOU ADIANTADO", gravidade: "ORIENTAR" },
  { chave: "ATRASADO|NO_HORARIO", titulo: "SAIU ATRASADO E INICIOU NO HORÁRIO", gravidade: "ORIENTAR" },
  { chave: "ATRASADO|ADIANTADO", titulo: "SAIU ATRASADO E INICIOU ADIANTADO", gravidade: "ORIENTAR" },
  { chave: "ATRASADO|ATRASADO", titulo: "SAIU ATRASADO E INICIOU ATRASADO", gravidade: "GRAVE" },
  { chave: "ADIANTADO|NO_HORARIO", titulo: "SAIU ADIANTADO E INICIOU NO HORÁRIO", gravidade: "GRAVE" },
  { chave: "ADIANTADO|ATRASADO", titulo: "SAIU ADIANTADO E INICIOU ATRASADO", gravidade: "GRAVE" },
  { chave: "ADIANTADO|ADIANTADO", titulo: "SAIU ADIANTADO E INICIOU ADIANTADO", gravidade: "GRAVE" }
];

function montarGraficosLiberacao_(dataDe, dataAte) {
  const janela = { dataDe: dataDe, dataAte: dataAte, ultimaSemanaOnly: false };
  const dados = lerAcompanhamentoLiberacao_("", 0, "", janela);
  const categorias = {};
  CATEGORIAS_BASE_DADOS_.forEach(function (cat) {
    categorias[cat.chave] = {};
  });
  dados.forEach(function (row) {
    const saida = situacaoSaidaLiberacao_(row);
    const inicio = situacaoInicioLiberacao_(row);
    const mot = String(row.motorista || "").trim();
    if (!saida || !inicio || !mot) return;
    const chave = chaveCategoriaLiberacao_(saida, inicio);
    if (!categorias[chave]) return;
    categorias[chave][mot] = (categorias[chave][mot] || 0) + 1;
  });
  return {
    ok: true,
    categorias: categorias,
    total_linhas: dados.length,
    meta: {
      versao: LIBERACAO_VERSAO,
      recurso: "graficos",
      data_de: dataDe,
      data_ate: dataAte,
      cache: false
    }
  };
}

function calcularResumoDiaLiberacao_(dados, dataIso) {
  let noHorario = 0;
  let atrasado = 0;
  let adiantado = 0;
  dados.forEach(function (row) {
    const s = situacaoSaidaLiberacao_(row);
    if (s === "NO_HORARIO") noHorario++;
    else if (s === "ATRASADO") atrasado++;
    else if (s === "ADIANTADO") adiantado++;
  });
  const qt = dados.length;
  return {
    data: dataIso || "",
    data_br: dataIso ? formatarDataBrLiberacao_(dataIso) : "",
    qt_saidas: qt,
    no_horario: noHorario,
    pct_no_horario: pctLiberacao_(noHorario, qt),
    atrasado: atrasado,
    pct_atrasado: pctLiberacao_(atrasado, qt),
    adiantado: adiantado,
    pct_adiantado: pctLiberacao_(adiantado, qt),
    total_pct: pctLiberacao_(noHorario + atrasado + adiantado, qt)
  };
}

function calcularHistoricoResumoLiberacao_() {
  const janela = montarJanelaLeituraLiberacao_("", "", "", true);
  const todos = lerAcompanhamentoLiberacao_("", 0, "", janela);
  const porData = {};
  todos.forEach(function (row) {
    const iso = normalizarDataIsoLiberacao_(row.data);
    if (!iso) return;
    if (!porData[iso]) porData[iso] = [];
    porData[iso].push(row);
  });
  return Object.keys(porData)
    .sort(function (a, b) { return b.localeCompare(a); })
    .map(function (iso) {
      return calcularResumoDiaLiberacao_(porData[iso], iso);
    });
}

function calcularBaseDadosLiberacao_(dados) {
  const mapa = {};
  CATEGORIAS_BASE_DADOS_.forEach(function (cat) {
    mapa[cat.chave] = { titulo: cat.titulo, gravidade: cat.gravidade, motoristas: {} };
  });

  dados.forEach(function (row) {
    const saida = situacaoSaidaLiberacao_(row);
    const inicio = situacaoInicioLiberacao_(row);
    if (!saida || !inicio) return;
    const chave = chaveCategoriaLiberacao_(saida, inicio);
    const mot = String(row.motorista || "").trim();
    if (!mot || !mapa[chave]) return;
    mapa[chave].motoristas[mot] = (mapa[chave].motoristas[mot] || 0) + 1;
  });

  return CATEGORIAS_BASE_DADOS_.map(function (cat) {
    const item = mapa[cat.chave];
    const lista = Object.keys(item.motoristas).sort(function (a, b) {
      return a.localeCompare(b, "pt-BR", { numeric: true });
    }).map(function (mot) {
      return { motorista: mot, qtd: item.motoristas[mot] };
    });
    return {
      titulo: cat.titulo,
      gravidade: cat.gravidade,
      total: lista.reduce(function (acc, cur) { return acc + cur.qtd; }, 0),
      motoristas: lista
    };
  });
}

function montarResumoDashboardLiberacao_(dataFiltro, incluirColunas) {
  const janela = montarJanelaLeituraLiberacao_("", "", "", true);
  const todos = lerAcompanhamentoLiberacao_("", 0, "", janela);
  const dadosDia = dataFiltro
    ? todos.filter(function (row) { return normalizarDataIsoLiberacao_(row.data) === dataFiltro; })
    : todos;
  const payload = {
    ok: true,
    resumo: calcularResumoDiaLiberacao_(dadosDia, dataFiltro),
    historico: calcularHistoricoResumoLiberacao_(),
    base_dados: calcularBaseDadosLiberacao_(dadosDia),
    dados: dadosDia,
    meta: {
      versao: LIBERACAO_VERSAO,
      recurso: "resumo",
      ultima_semana: true,
      data_inicio: isoDataDiasAtrasLiberacao_(LIBERACAO_DIAS_JANELA)
    }
  };
  if (incluirColunas) payload.colunas = lerColunasAcompanhamento_();
  return payload;
}

function pickCampoLiberacao_(obj, chaves) {
  for (let i = 0; i < chaves.length; i++) {
    if (obj[chaves[i]]) return obj[chaves[i]];
  }
  return "";
}

function aplicarAliasesCamposLiberacao_(item) {
  if (item.horario_de_saida_da_garagem && !item.horario_saida_da_garagem) {
    item.horario_saida_da_garagem = item.horario_de_saida_da_garagem;
  }
  if (item.saiu_no_horaro && !item.saiu_no_horario) {
    item.saiu_no_horario = item.saiu_no_horaro;
  }
  return item;
}

function expandirParamsColunasPlanilha_(params, chaves) {
  const out = {};
  chaves.forEach(function (chave) {
    if (params[chave] != null) out[chave] = params[chave];
  });
  const aliases = [
    ["horario_saida_da_garagem", "horario_de_saida_da_garagem"],
    ["saiu_no_horario", "saiu_no_horaro"]
  ];
  aliases.forEach(function (par) {
    if (params[par[0]] == null) return;
    if (chaves.indexOf(par[0]) >= 0) out[par[0]] = params[par[0]];
    if (chaves.indexOf(par[1]) >= 0) out[par[1]] = params[par[1]];
  });
  return out;
}

function upsertAcompanhamentoLiberacao_(params) {
  const row = parseInt(params._row || params.row || "0", 10);
  if (row && row >= 2) return atualizarAcompanhamentoLiberacao_(params);
  const workId = String(params.work_id || "").trim();
  const dataIso = normalizarDataIsoLiberacao_(params.data || "");
  if (workId && dataIso) {
    const existente = encontrarLinhaAcompanhamento_(dataIso, workId);
    if (existente) {
      params._row = existente._row;
      return atualizarAcompanhamentoLiberacao_(params);
    }
  }
  return criarAcompanhamentoLiberacao_(params);
}

function encontrarLinhaAcompanhamento_(dataIso, workId) {
  const janela = { dataDe: dataIso, dataAte: dataIso, ultimaSemanaOnly: false };
  const dados = lerAcompanhamentoLiberacao_(dataIso, 0, "", janela);
  for (var i = 0; i < dados.length; i++) {
    if (String(dados[i].work_id || "").trim() === String(workId).trim()) return dados[i];
  }
  return null;
}

function criarAcompanhamentoLiberacao_(params) {
  const sheet = abrirAbaPorGid_(LIBERACAO_SPREADSHEET_ID, LIBERACAO_ACOMPANHAMENTO_GID);
  const cabecalho = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const chaves = cabecalho.map(normalizarChaveLiberacao_);
  const valoresParams = expandirParamsColunasPlanilha_(params, chaves);
  const linha = chaves.map(function (chave) {
    return valoresParams[chave] != null ? String(valoresParams[chave]) : "";
  });
  sheet.appendRow(linha);
  invalidarCacheLiberacao_();
  try { solicitarAtualizacaoJsonLiberacaoHoje_("liberacao-create"); } catch (_) {}
  return { ok: true, linha: sheet.getLastRow(), acao: "create" };
}

function atualizarAcompanhamentoLiberacao_(params) {
  const row = parseInt(params._row || params.row || "0", 10);
  if (!row || row < 2) throw new Error("Linha inválida para atualização.");
  const sheet = abrirAbaPorGid_(LIBERACAO_SPREADSHEET_ID, LIBERACAO_ACOMPANHAMENTO_GID);
  const lastCol = sheet.getLastColumn();
  const cabecalho = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const chaves = cabecalho.map(normalizarChaveLiberacao_);
  const valoresParams = expandirParamsColunasPlanilha_(params, chaves);
  chaves.forEach(function (chave, idx) {
    if (!chave || valoresParams[chave] == null) return;
    sheet.getRange(row, idx + 1).setValue(valoresParams[chave]);
  });
  invalidarCacheLiberacao_();
  try { solicitarAtualizacaoJsonLiberacaoHoje_("liberacao-update"); } catch (_) {}
  return { ok: true, linha: row, acao: "update" };
}

function linhaAcompanhamentoParaObjeto_(cabecalho, valores, rowNumber) {
  const item = { _row: rowNumber };
  cabecalho.forEach(function (chave, idx) {
    if (!chave) return;
    item[chave] = valorCelulaLiberacao_(valores[idx]);
  });
  aplicarAliasesCamposLiberacao_(item);
  if (item.data) item.data_iso = normalizarDataIsoLiberacao_(item.data);
  return item;
}

function valorCelulaLiberacao_(valor) {
  if (valor == null || valor === "") return "";
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) {
    const tz = Session.getScriptTimeZone();
    if (valor.getHours() === 0 && valor.getMinutes() === 0 && valor.getSeconds() === 0) {
      return Utilities.formatDate(valor, tz, "dd/MM/yyyy");
    }
    return Utilities.formatDate(valor, tz, "HH:mm");
  }
  return String(valor).trim();
}

function parseNumeroLiberacao_(valor) {
  if (valor == null || valor === "") return 0;
  const texto = String(valor).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const num = Number(texto);
  return isNaN(num) ? 0 : num;
}

function parsePercentualLiberacao_(valor) {
  return parseNumeroLiberacao_(valor);
}

function normalizarChaveLiberacao_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarDataIsoLiberacao_(valor) {
  if (!valor) return "";
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + "-" + br[2] + "-" + br[1];
  return "";
}
