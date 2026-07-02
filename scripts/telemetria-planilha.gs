/**
 * Telemetria TCGL — Web App (abas Clever + TCGL)
 *
 * Planilha: https://docs.google.com/spreadsheets/d/1Z_rFA-1jz7-kq4juGp5uFG4WMpVBloML98hDgWcX9gQ/edit
 *
 * INSTALAÇÃO
 * 1. Na planilha: Extensões → Apps Script → colar este arquivo → Salvar
 * 2. Implantar → Nova implantação → Aplicativo da Web
 *    - Executar como: Eu
 *    - Quem tem acesso: Qualquer pessoa
 * 3. Copiar a URL do Web App (use no portal ou no script de importação)
 *    Deploy atual: https://script.google.com/macros/s/AKfycbzXrGVHJauMOgrHqLpjex2RodmQZoOIrA4lUeoDRnKrc0ZbCc6c7A4ET5B6H-ogsFYBNg/exec
 *    → assets/data/portal-runtime.json → telemetriaScriptUrl
 *
 * OPCIONAL — atualizar JSON no GitHub automaticamente:
 * Propriedades do script → GITHUB_PAT = token com repo (portal-teste)
 *
 * GET ?debug=1
 * GET ?fonte=clever|tcgl|todos&de=YYYY-MM-DD&ate=YYYY-MM-DD
 * GET ?resumo=1
 */

const TELEMETRIA_VERSAO = "2026-07-04-planilha-clever-tcgl";
const ABA_CLEVER = "Clever";
const ABA_TCGL = "TCGL";
const CACHE_TTL = 300;

const MAP_COLUNAS_EN_PT = {
  "vehicle id": "Veiculo",
  "date": "Data",
  "start time local": "Inicio",
  "end time local": "Fim",
  "number of events": "Registros CAN",
  "start distance": "Km Inicial",
  "end distance": "Km Final",
  "daily distance": "Km Percorrido",
  "daily fuel consumption l": "Consumo Combustivel (L)",
  "daily engine hours": "Horas Motor",
  "daily avg km per liter": "Media Km/L",
  "avg speed": "Velocidade Media",
  "max speed": "Velocidade Maxima",
  "avg engine temp": "Temperatura Motor Media",
  "max engine temp": "Temperatura Motor Maxima",
  "avg ambient temp": "Temperatura Ambiente Media",
  "avg air pressure": "Pressao Ar Media",
  "max air pressure": "Pressao Ar Maxima"
};

const COLUNAS_EXCLUIDAS = {
  "customer id": true,
  "avg cabin temp": true,
  "avg fuel economy": true
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Portal CIOP")
    .addItem("Resumo Clever / TCGL", "menuResumoTelemetria_")
    .addItem("Invalidar cache", "menuInvalidarCacheTelemetria_")
    .addItem("Copiar URL do JSON", "menuCopiarUrlJson_")
    .addSeparator()
    .addItem("Disparar atualização no GitHub (teste)", "menuDispararGithubTeste_")
  .addToUi();
}

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    if (String(params.debug || "") === "1") {
      return respostaJson_(montarDebugTelemetria_());
    }
    if (String(params.resumo || "") === "1") {
      return respostaJson_(montarResumoTelemetria_());
    }
    return respostaJson_(montarSnapshotTelemetria_(params));
  } catch (err) {
    return respostaJson_({
      ok: false,
      erro: String(err && err.message ? err.message : err),
      script_versao: TELEMETRIA_VERSAO
    });
  }
}

function menuResumoTelemetria_() {
  var resumo = montarResumoTelemetria_();
  var msg = [
    "Clever: " + resumo.total_clever + " registro(s)",
    "TCGL: " + resumo.total_tcgl + " registro(s)",
    "Período: " + (resumo.data_de || "—") + " a " + (resumo.data_ate || "—"),
    "Atualizado: " + resumo.atualizadoEm
  ].join("\n");
  SpreadsheetApp.getUi().alert("Telemetria", msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuInvalidarCacheTelemetria_() {
  invalidarCacheTelemetria_();
  SpreadsheetApp.getUi().alert("Cache da telemetria invalidado.");
}

function menuCopiarUrlJson_() {
  var url = obterUrlWebApp_();
  if (!url) {
    SpreadsheetApp.getUi().alert("Implante o Web App primeiro (Implantar → Aplicativo da Web).");
    return;
  }
  var html = HtmlService.createHtmlOutput(
    "<textarea style='width:100%;height:120px'>" + url + "</textarea>"
  ).setWidth(420).setHeight(160);
  SpreadsheetApp.getUi().showModalDialog(html, "URL JSON telemetria");
}

function menuDispararGithubTeste_() {
  dispararAtualizacaoGithub_("portal-teste");
  SpreadsheetApp.getUi().alert("Solicitação enviada ao GitHub (portal-teste). Verifique Actions.");
}

function montarDebugTelemetria_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    ok: true,
    script_versao: TELEMETRIA_VERSAO,
    planilha: ss.getId(),
    abas: ss.getSheets().map(function (s) {
      return { nome: s.getName(), gid: s.getSheetId(), linhas: s.getLastRow() };
    }),
    clever: debugAba_(obterAbaPorNome_(ABA_CLEVER)),
    tcgl: debugAba_(obterAbaPorNome_(ABA_TCGL))
  };
}

function debugAba_(sheet) {
  if (!sheet) return { erro: "Aba não encontrada" };
  var display = sheet.getDataRange().getDisplayValues();
  if (!display.length) return { erro: "Aba vazia" };
  var headerIdx = encontrarLinhaCabecalho_(display);
  var headers = (display[headerIdx] || []).map(function (h) { return String(h || "").trim(); });
  return {
    nome: sheet.getName(),
    linha_cabecalho: headerIdx + 1,
    headers: headers,
    amostra: display.slice(headerIdx + 1, headerIdx + 4).map(function (linha, i) {
      return { linha: headerIdx + 2 + i, valores: linha };
    })
  };
}

function montarResumoTelemetria_() {
  var snap = montarSnapshotTelemetria_({});
  return {
    ok: true,
    script_versao: TELEMETRIA_VERSAO,
    atualizadoEm: snap.atualizadoEm,
    total: snap.total,
    total_clever: snap.total_clever,
    total_tcgl: snap.total_tcgl,
    data_de: snap.data_de,
    data_ate: snap.data_ate
  };
}

function montarSnapshotTelemetria_(params) {
  var fonteParam = String(params.fonte || "todos").toLowerCase();
  var de = normalizarDataIso_(params.de || "");
  var ate = normalizarDataIso_(params.ate || "");
  var chave = cacheChaveTelemetria_(fonteParam, de, ate);
  var cache = lerCacheTelemetria_(chave);
  if (cache) return cache;

  var clever = (fonteParam === "tcgl") ? [] : lerRegistrosAba_(ABA_CLEVER, "clever");
  var tcgl = (fonteParam === "clever") ? [] : lerRegistrosAba_(ABA_TCGL, "tcgl");
  var dados = clever.concat(tcgl);

  if (de || ate) {
    dados = dados.filter(function (r) {
      if (de && r.data_iso < de) return false;
      if (ate && r.data_iso > ate) return false;
      return true;
    });
  }

  dados.sort(function (a, b) {
    if (a.data_iso !== b.data_iso) return a.data_iso < b.data_iso ? -1 : 1;
    return String(a.veiculo).localeCompare(String(b.veiculo), "pt-BR", { numeric: true });
  });

  var datas = dados.map(function (d) { return d.data_iso; }).filter(Boolean).sort();
  var snap = {
    ok: true,
    script_versao: TELEMETRIA_VERSAO,
    atualizadoEm: new Date().toISOString(),
    origem: "google-sheets",
    planilhaId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    fontes: ["clever", "tcgl"],
    total: dados.length,
    total_clever: clever.length,
    total_tcgl: tcgl.length,
    data_de: datas.length ? datas[0] : null,
    data_ate: datas.length ? datas[datas.length - 1] : null,
    dados: dados
  };

  gravarCacheTelemetria_(chave, snap);
  return snap;
}

function lerRegistrosAba_(nomeAba, fonte) {
  var sheet = obterAbaPorNome_(nomeAba);
  if (!sheet) return [];
  var display = sheet.getDataRange().getDisplayValues();
  if (!display.length) return [];

  var headerIdx = encontrarLinhaCabecalho_(display);
  var headers = (display[headerIdx] || []).map(function (h) { return String(h || "").trim(); });
  var colVeiculo = detectarColuna_(headers, ["veiculo", "vehicle id", "vehicle", "carro", "prefixo"]);
  var colData = detectarColuna_(headers, ["data", "date", "dia"]);
  if (!colVeiculo || !colData) return [];

  var grupos = {};
  for (var i = headerIdx + 1; i < display.length; i++) {
    var linha = display[i];
    if (!linha || !linha.some(function (c) { return valorPreenchido_(c); })) continue;

    var row = {};
    headers.forEach(function (h, idx) {
      var col = normalizarColunaTelemetria_(h);
      if (!col) return;
      row[col] = String(linha[idx] != null ? linha[idx] : "").trim();
    });

    var veiculo = normalizarVeiculo_(row[colVeiculo] || row.Veiculo || "");
    var dataIso = normalizarDataIso_(row[colData] || row.Data || "");
    if (!veiculo || !dataIso) continue;

    row.Veiculo = veiculo;
    row.Data = dataIso;
    row.data_iso = dataIso;
    row.veiculo_norm = veiculo;

    var key = dataIso + "|" + veiculo;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(row);
  }

  var registros = [];
  Object.keys(grupos).forEach(function (key) {
    var partes = key.split("|");
    var dataIso = partes[0];
    var veiculo = partes[1];
    var payload = agregarLinhasTelemetria_(grupos[key]);
    payload.Veiculo = veiculo;
    payload.Data = dataIso;
    payload.data_iso = dataIso;
    payload.veiculo_norm = veiculo;
    registros.push({
      data_iso: dataIso,
      veiculo: veiculo,
      fonte: fonte,
      payload: payload,
      origem_arquivo: "planilha-" + fonte
    });
  });
  return registros;
}

function agregarLinhasTelemetria_(linhas) {
  if (!linhas || !linhas.length) return {};
  var chaves = {};
  linhas.forEach(function (row) {
    Object.keys(row || {}).forEach(function (k) { chaves[k] = true; });
  });
  var out = {};
  Object.keys(chaves).forEach(function (col) {
    out[col] = agregarValorColuna_(col, linhas.map(function (r) { return r[col]; }));
  });
  return out;
}

function agregarValorColuna_(col, valores) {
  var preenchidos = valores.filter(valorPreenchido_);
  if (!preenchidos.length) return "";

  var n = normChave_(col);
  if (["cliente", "veiculo", "data", "data iso", "veiculo norm"].indexOf(n) >= 0) {
    return preenchidos[preenchidos.length - 1];
  }
  if (n === "inicio" || n === "start time local") {
    return minTexto_(preenchidos);
  }
  if (n === "fim" || n === "end time local") {
    return maxTexto_(preenchidos);
  }
  if (n.indexOf("horas motor") >= 0) {
    return preenchidos[preenchidos.length - 1];
  }

  var nums = preenchidos.map(parseNumero_).filter(function (x) { return !isNaN(x); });
  if (nums.length) {
    var soma = nums.reduce(function (a, b) { return a + b; }, 0);
    return String(Math.round(soma * 1000) / 1000);
  }
  return preenchidos[preenchidos.length - 1];
}

function encontrarLinhaCabecalho_(linhas) {
  for (var i = 0; i < Math.min(linhas.length, 12); i++) {
    var textos = (linhas[i] || []).map(function (c) { return normChave_(c); });
    if (textos.some(function (t) { return t === "veiculo" || t === "vehicle id" || t.indexOf("veiculo") >= 0; })) {
      return i;
    }
  }
  return 0;
}

function detectarColuna_(headers, chaves) {
  for (var i = 0; i < headers.length; i++) {
    var n = normChave_(headers[i]);
    for (var j = 0; j < chaves.length; j++) {
      if (n === chaves[j] || n.indexOf(chaves[j]) >= 0) return headers[i];
    }
  }
  return "";
}

function normalizarColunaTelemetria_(nome) {
  var original = String(nome || "").trim();
  if (!original) return null;
  var chave = normChave_(original);
  if (COLUNAS_EXCLUIDAS[chave]) return null;
  if (MAP_COLUNAS_EN_PT[chave]) return MAP_COLUNAS_EN_PT[chave];
  return original;
}

function normalizarVeiculo_(v) {
  var s = String(v || "").trim();
  if (!s) return "";
  var digits = s.replace(/\D/g, "");
  if (digits) return String(parseInt(digits, 10));
  return s.toUpperCase();
}

function normalizarDataIso_(val) {
  var s = String(val || "").trim();
  if (!s) return "";
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return "";
}

function parseNumero_(val) {
  var s = String(val != null ? val : "").trim();
  if (!s) return NaN;
  var hasComma = s.indexOf(",") >= 0;
  var hasDot = s.indexOf(".") >= 0;
  var normalized = s;
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (hasDot) {
    var parts = s.split(".");
    normalized = parts.length > 2 ? parts.join("") : s;
  }
  var n = Number(normalized);
  return isNaN(n) ? NaN : n;
}

function valorPreenchido_(v) {
  var s = String(v != null ? v : "").trim();
  if (!s) return false;
  var low = s.toLowerCase();
  return ["-", "—", "n/a", "na", "null", "undefined", "#n/a"].indexOf(low) < 0;
}

function normChave_(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function minTexto_(vals) {
  var melhor = null;
  var melhorTs = Infinity;
  vals.forEach(function (v) {
    var ts = parseDataHora_(v);
    if (!isNaN(ts) && ts < melhorTs) { melhorTs = ts; melhor = v; }
  });
  return melhor != null ? melhor : vals[0];
}

function maxTexto_(vals) {
  var melhor = null;
  var melhorTs = -Infinity;
  vals.forEach(function (v) {
    var ts = parseDataHora_(v);
    if (!isNaN(ts) && ts > melhorTs) { melhorTs = ts; melhor = v; }
  });
  return melhor != null ? melhor : vals[vals.length - 1];
}

function parseDataHora_(val) {
  var s = String(val != null ? val : "").trim();
  if (!s) return NaN;
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return new Date(m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":00").getTime();
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T](\d{2}):(\d{2})/);
  if (m) return new Date(m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) + "T" + m[4] + ":" + m[5] + ":00").getTime();
  var d = new Date(s);
  return isNaN(d.getTime()) ? NaN : d.getTime();
}

function obterAbaPorNome_(nome) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nome);
  if (sheet) return sheet;
  var alvo = normChave_(nome);
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (normChave_(sheets[i].getName()) === alvo) return sheets[i];
  }
  return null;
}

function cacheChaveTelemetria_(fonte, de, ate) {
  return "tel-" + TELEMETRIA_VERSAO + "-" + versaoCacheTelemetria_() + "-" + fonte + "-" + de + "-" + ate;
}

function versaoCacheTelemetria_() {
  return PropertiesService.getScriptProperties().getProperty("telemetria_cache_v") || "0";
}

function invalidarCacheTelemetria_() {
  PropertiesService.getScriptProperties().setProperty("telemetria_cache_v", String(Date.now()));
}

function lerCacheTelemetria_(chave) {
  try {
    var raw = CacheService.getScriptCache().get(chave);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function gravarCacheTelemetria_(chave, obj) {
  try {
    CacheService.getScriptCache().put(chave, JSON.stringify(obj), CACHE_TTL);
  } catch (err) {}
}

function obterUrlWebApp_() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    return "";
  }
}

function dispararAtualizacaoGithub_(repo) {
  var token = PropertiesService.getScriptProperties().getProperty("GITHUB_PAT");
  if (!token) throw new Error("Defina GITHUB_PAT nas propriedades do script.");
  UrlFetchApp.fetch("https://api.github.com/repos/odairmpicolo-blip/" + repo + "/dispatches", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    payload: JSON.stringify({
      event_type: "telemetria",
      client_payload: {
        origem: "apps-script",
        ts: new Date().toISOString()
      }
    }),
    muteHttpExceptions: true
  });
}

function respostaJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
