/**
 * Dashboard de Autuações TCGL — Web App (leitura + gravação de evidências)
 *
 * Planilha: https://docs.google.com/spreadsheets/d/1kkohM1xJMbQvyyJKayOBpgtL0qFWKQGSa1U8lhwwbes/edit?gid=150506325
 *
 * GET  leitura do dashboard (como antes)
 * GET  ?evidencias=1&...   upsert da ficha
 * POST JSON { evidencias:"1", notificacao, auto, data, motivo, carro, linha, ... }
 *
 * Reimplantar o Web App após alterar este arquivo (Executar como: eu / Quem acessa: qualquer pessoa).
 */

const ABA_NOME = "AUTUAÇÕES";
const SCRIPT_VERSAO = "2026-08-21-evidencias-upsert";
const AUTUACOES_DIAS_JANELA = 365;
const AUTUACOES_DATA_INICIO = "2015-01-01";
const AUTUACOES_CHUNK_LINHAS = 800;
const AUTUACOES_CACHE_TTL = 900;
const EVIDENCIAS_SHEET_ID = "1kkohM1xJMbQvyyJKayOBpgtL0qFWKQGSa1U8lhwwbes";
const EVIDENCIAS_GID = 150506325;
const COLUNAS_EVIDENCIA = [
  "Carro",
  "Linha",
  "Placa",
  "Horário",
  "Motorista",
  "Matrícula",
  "Local",
  "Evidenciado em",
  "Usuário"
];

const MAPA_COLUNAS = {
  ordem: ["ordem", "Ordem", "ORDEM"],
  data: ["Data", "DATA", "data", "Data da autuação", "Data da autuacao"],
  notificacao: ["Notificação Nº", "Notificacao Nº", "NOTIFICAÇÃO", "Notificação", "notificacao", "Notificacao"],
  auto: ["Auto de Infração Nº", "Auto de Infracao Nº", "AUTO", "Auto", "auto", "Auto Nº", "Auto N"],
  motivo: ["Motivo", "MOTIVO", "motivo"],
  agente: ["Agente", "AGENTE", "agente"],
  grupo: ["Grupo", "GRUPO", "grupo"],
  artigo: ["Artigo", "ARTIGO", "artigo", "Art.", "Artigo CTB", "Nº Artigo"],
  valor_tarifas: [
    "valor do auto em tarifas",
    "Valor do auto em tarifas",
    "VALOR DO AUTO EM TARIFAS",
    "Valor auto em tarifas",
    "Tarifas",
    "TARIFAS",
    "Qtde Tarifas",
    "Qtd Tarifas"
  ],
  valor_reais: [
    "valor em R$",
    "Valor em R$",
    "VALOR EM R$",
    "Valor R$",
    "VALOR R$",
    "R$",
    "Valor (R$)",
    "Valor em Reais",
    "Valor Reais"
  ]
};

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    if (String(params.debug || "") === "1") {
      return respostaJson_(montarDebugAutuacoes_());
    }
    if (String(params.evidencias || "") === "1") {
      return respostaJson_(upsertEvidenciaAuto_(params));
    }
    return respostaJson_(montarPayloadAutuacoes_(params));
  } catch (error) {
    return respostaJson_({
      status: "error",
      message: String(error && error.message ? error.message : error),
      script_versao: SCRIPT_VERSAO
    });
  }
}

function doPost(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents) || {};
      } catch (ignore) {}
    }
    var dados = Object.assign({}, params, body);
    if (String(dados.evidencias || "") === "1" || String(dados.action || "").toLowerCase() === "upsert") {
      return respostaJson_(upsertEvidenciaAuto_(dados));
    }
    return respostaJson_({ status: "error", message: "POST sem evidencias=1" });
  } catch (error) {
    return respostaJson_({
      status: "error",
      message: String(error && error.message ? error.message : error),
      script_versao: SCRIPT_VERSAO
    });
  }
}

function montarDebugAutuacoes_() {
  var sheet = obterAbaAutuacoes_();
  var display = sheet.getDataRange().getDisplayValues();
  var bruto = sheet.getDataRange().getValues();
  var headers = display[0].map(function (h) { return String(h || "").trim(); });
  var idx = mapearIndices_(headers);
  var amostra = [];

  for (var i = 1; i < Math.min(display.length, 6); i++) {
    amostra.push({
      linha: i + 1,
      display: linhaResumo_(display[i], idx),
      bruto: linhaResumo_(bruto[i], idx)
    });
  }

  return {
    status: "ok",
    script_versao: SCRIPT_VERSAO,
    aba: sheet.getName(),
    headers: headers,
    indices: idx,
    amostra: amostra
  };
}

function linhaResumo_(linha, idx) {
  return {
    ordem: valorCelula_(linha, idx.ordem),
    data: valorCelula_(linha, idx.data),
    grupo: valorCelula_(linha, idx.grupo),
    artigo: valorCelula_(linha, idx.artigo),
    valor_tarifas: valorCelula_(linha, idx.valor_tarifas),
    valor_reais: valorCelula_(linha, idx.valor_reais)
  };
}

function cacheChaveAutuacoes_(dataDe, dataAte) {
  return "aut-" + SCRIPT_VERSAO + "-" + dataDe + "-" + dataAte;
}

function lerCacheAutuacoes_(chave) {
  try {
    var raw = CacheService.getScriptCache().get(chave);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function gravarCacheAutuacoes_(chave, obj) {
  try {
    CacheService.getScriptCache().put(chave, JSON.stringify(obj), AUTUACOES_CACHE_TTL);
  } catch (err) {}
}

function isoDataDiasAtrasAutuacoes_(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function normalizarDataParamAutuacoes_(valor) {
  if (!valor) return "";
  var bruto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return bruto;
  var br = bruto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    return br[3] + "-" + ("0" + br[2]).slice(-2) + "-" + ("0" + br[1]).slice(-2);
  }
  return "";
}

function montarPayloadAutuacoes_(params) {
  params = params || {};
  var completo = String(params.completo || params.todos || "") === "1";
  var dataDe;
  var dataAte = normalizarDataParamAutuacoes_(params.data_ate) || isoDataDiasAtrasAutuacoes_(0);
  if (completo) {
    dataDe = normalizarDataParamAutuacoes_(params.data_de) || AUTUACOES_DATA_INICIO;
  } else {
    dataDe = normalizarDataParamAutuacoes_(params.data_de) || isoDataDiasAtrasAutuacoes_(AUTUACOES_DIAS_JANELA);
  }
  var cacheKey = completo
    ? cacheChaveAutuacoes_("completo", dataDe + "|" + dataAte)
    : cacheChaveAutuacoes_(dataDe, dataAte);
  var emCache = lerCacheAutuacoes_(cacheKey);
  if (emCache) {
    emCache.cache = true;
    return emCache;
  }

  var dados = lerAutuacoesJanela_(dataDe, dataAte);
  var payload = {
    status: "ok",
    total: dados.length,
    script_versao: SCRIPT_VERSAO,
    data_de: dataDe,
    data_ate: dataAte,
    data: dados,
    cache: false
  };
  gravarCacheAutuacoes_(cacheKey, payload);
  return payload;
}

function lerAutuacoesJanela_(dataMinIso, dataMaxIso) {
  var sheet = obterAbaAutuacoes_();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  var cabecalhoRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headers = cabecalhoRow.map(function (h) { return String(h || "").trim(); });
  var idx = mapearIndices_(headers);
  var dados = [];
  var endRow = lastRow;

  while (endRow >= 2) {
    var startRow = Math.max(2, endRow - AUTUACOES_CHUNK_LINHAS + 1);
    var numRows = endRow - startRow + 1;
    var valores = sheet.getRange(startRow, 1, numRows, lastCol).getValues();
    var parar = false;

    for (var i = valores.length - 1; i >= 0; i--) {
      var linhaBruto = valores[i];
      if (!linhaTemConteudoBruto_(linhaBruto)) continue;

      var dataObj = parseDataLinha_(linhaBruto, null, idx.data);
      var iso = dataObj.iso;

      if (dataMinIso && iso && iso < dataMinIso) {
        parar = true;
        break;
      }
      if (dataMaxIso && iso && iso > dataMaxIso) continue;

      dados.push(montarRegistroAutuacao_(linhaBruto, idx, startRow + i, dataObj));
    }

    if (parar) break;
    endRow = startRow - 1;
  }

  return dados;
}

function linhaTemConteudoBruto_(linha) {
  if (!linha) return false;
  for (var i = 0; i < linha.length; i++) {
    var val = linha[i];
    if (val instanceof Date) return true;
    if (String(val || "").trim()) return true;
  }
  return false;
}

function montarRegistroAutuacao_(linhaBruto, idx, ordemFallback, dataObj) {
  return {
    ordem: idx.ordem >= 0 ? textoCelulaBruto_(linhaBruto, idx.ordem) : ordemFallback,
    data_iso: dataObj.iso,
    data_br: dataObj.br,
    notificacao: textoCelulaBruto_(linhaBruto, idx.notificacao),
    auto: textoCelulaBruto_(linhaBruto, idx.auto),
    motivo: textoCelulaBruto_(linhaBruto, idx.motivo),
    agente: textoCelulaBruto_(linhaBruto, idx.agente),
    grupo: textoCelulaBruto_(linhaBruto, idx.grupo),
    artigo: textoCelulaBruto_(linhaBruto, idx.artigo),
    valor_tarifas: numeroCelula_(linhaBruto, linhaBruto, idx.valor_tarifas),
    valor_reais: numeroCelula_(linhaBruto, linhaBruto, idx.valor_reais)
  };
}

function textoCelulaBruto_(linha, idx) {
  if (idx < 0 || !linha) return "";
  var val = linha[idx];
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  return String(val == null ? "" : val).trim();
}

function obterAbaAutuacoes_() {
  var ss = null;
  try {
    ss = SpreadsheetApp.openById(EVIDENCIAS_SHEET_ID);
  } catch (err) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!ss) throw new Error("Abra o Apps Script a partir da planilha de autuações.");
  var sheets = ss.getSheets();
  var i;
  for (i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getSheetId()) === String(EVIDENCIAS_GID)) return sheets[i];
  }
  var sheet = ss.getSheetByName(ABA_NOME);
  if (!sheet) sheet = sheets.length ? sheets[0] : null;
  if (!sheet) throw new Error("Nenhuma aba encontrada na planilha de autuações.");
  return sheet;
}

function mapearIndices_(headers) {
  var mapa = {};
  Object.keys(MAPA_COLUNAS).forEach(function (campo) {
    mapa[campo] = indiceColuna_(headers, MAPA_COLUNAS[campo]);
  });

  if (mapa.artigo < 0) mapa.artigo = indiceColunaContem_(headers, "artigo");
  if (mapa.valor_tarifas < 0) mapa.valor_tarifas = indiceColunaContem_(headers, "tarif");
  if (mapa.valor_reais < 0) mapa.valor_reais = indiceColunaReais_(headers);

  if (mapa.grupo >= 0) {
    if (mapa.artigo < 0 && mapa.grupo + 1 < headers.length) mapa.artigo = mapa.grupo + 1;
    if (mapa.valor_tarifas < 0 && mapa.grupo + 2 < headers.length) mapa.valor_tarifas = mapa.grupo + 2;
    if (mapa.valor_reais < 0 && mapa.grupo + 3 < headers.length) mapa.valor_reais = mapa.grupo + 3;
  }

  return mapa;
}

function indiceColuna_(headers, candidatos) {
  var normalizados = headers.map(normalizarCabecalho_);
  for (var i = 0; i < candidatos.length; i++) {
    var idx = normalizados.indexOf(normalizarCabecalho_(candidatos[i]));
    if (idx >= 0) return idx;
  }
  return -1;
}

function indiceColunaContem_(headers, trecho) {
  var alvo = normalizarCabecalho_(trecho);
  for (var i = 0; i < headers.length; i++) {
    if (normalizarCabecalho_(headers[i]).indexOf(alvo) >= 0) return i;
  }
  return -1;
}

function indiceColunaReais_(headers) {
  for (var i = 0; i < headers.length; i++) {
    var norm = normalizarCabecalho_(headers[i]);
    if (norm.indexOf("r$") >= 0) return i;
    if (norm.indexOf("reais") >= 0 && norm.indexOf("valor") >= 0) return i;
  }
  return -1;
}

function normalizarCabecalho_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function linhaTemConteudo_(linha) {
  if (!linha) return false;
  for (var i = 0; i < linha.length; i++) {
    if (String(linha[i] || "").trim()) return true;
  }
  return false;
}

function valorCelula_(linha, idx) {
  if (idx < 0 || !linha) return "";
  return linha[idx];
}

function textoCelula_(linha, idx) {
  if (idx < 0 || !linha) return "";
  return String(linha[idx] == null ? "" : linha[idx]).trim();
}

function numeroCelula_(linhaBruto, linhaDisplay, idx) {
  if (idx < 0) return 0;
  var bruto = linhaBruto ? linhaBruto[idx] : "";
  var display = linhaDisplay ? linhaDisplay[idx] : "";
  if (typeof bruto === "number" && isFinite(bruto)) return bruto;
  return parseNumero_(display !== "" ? display : bruto);
}

function parseDataLinha_(linhaBruto, linhaDisplay, idxData) {
  if (idxData >= 0 && linhaBruto) {
    var bruto = linhaBruto[idxData];
    if (bruto instanceof Date && !isNaN(bruto.getTime())) {
      return formatarData_(bruto);
    }
  }
  return parseDataTexto_(idxData >= 0 && linhaDisplay ? linhaDisplay[idxData] : "");
}

function parseDataTexto_(texto) {
  var bruto = String(texto || "").trim();
  if (!bruto) return { iso: "", br: "" };

  var br = bruto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    var dia = ("0" + br[1]).slice(-2);
    var mes = ("0" + br[2]).slice(-2);
    var ano = br[3].length === 2 ? "20" + br[3] : br[3];
    return { iso: ano + "-" + mes + "-" + dia, br: dia + "/" + mes + "/" + ano };
  }

  var dt = new Date(bruto);
  if (!isNaN(dt.getTime())) return formatarData_(dt);
  return { iso: "", br: bruto };
}

function formatarData_(date) {
  var tz = Session.getScriptTimeZone() || "America/Sao_Paulo";
  return {
    iso: Utilities.formatDate(date, tz, "yyyy-MM-dd"),
    br: Utilities.formatDate(date, tz, "dd/MM/yyyy")
  };
}

function parseNumero_(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number" && isFinite(valor)) return valor;
  var texto = String(valor).trim().replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (!texto || texto === "-") return 0;
  if (texto.indexOf(",") >= 0 && texto.indexOf(".") >= 0) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.indexOf(",") >= 0) {
    texto = texto.replace(",", ".");
  }
  var n = Number(texto);
  return isFinite(n) ? n : 0;
}

function respostaJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizarChaveEv_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/n[oº°.]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function autoIdEv_(valor) {
  return String(valor || "").replace(/^0+/, "").trim();
}

function hojeBrEv_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Sao_Paulo", "dd/MM/yyyy");
}

function garantirColunasEvidencia_(sheet, headers) {
  var existentes = headers.map(normalizarChaveEv_);
  var mudou = false;
  COLUNAS_EVIDENCIA.forEach(function (titulo) {
    if (existentes.indexOf(normalizarChaveEv_(titulo)) < 0) {
      headers.push(titulo);
      existentes.push(normalizarChaveEv_(titulo));
      mudou = true;
    }
  });
  if (mudou) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return headers;
}

function indiceHeaderEv_(headers, aliases) {
  var norms = headers.map(normalizarChaveEv_);
  for (var i = 0; i < aliases.length; i++) {
    var idx = norms.indexOf(normalizarChaveEv_(aliases[i]));
    if (idx >= 0) return idx;
  }
  return -1;
}

function upsertEvidenciaAuto_(dados) {
  dados = dados || {};
  var notificacao = String(dados.notificacao || dados.protocolo || "").trim();
  var autoId = autoIdEv_(dados.auto || dados.autoId || "");
  if (!notificacao && !autoId) {
    return { status: "error", ok: false, message: "Informe notificação/protocolo ou número do auto." };
  }

  var sheet = obterAbaAutuacoes_();
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(function (h) {
    return String(h || "").trim();
  });
  headers = garantirColunasEvidencia_(sheet, headers);
  lastCol = headers.length;

  var idxNotif = indiceHeaderEv_(headers, ["Notificação Nº", "Notificacao", "notificacao"]);
  var idxAuto = indiceHeaderEv_(headers, ["Auto de Infração Nº", "Auto", "auto"]);
  var idxOrdem = indiceHeaderEv_(headers, ["Ordem"]);
  var idxRecebido = indiceHeaderEv_(headers, ["Recebido"]);
  var idxData = indiceHeaderEv_(headers, ["Data"]);
  var idxMotivo = indiceHeaderEv_(headers, ["Motivo"]);
  var idxAgente = indiceHeaderEv_(headers, ["Agente", "Autuador"]);
  var idxCarro = indiceHeaderEv_(headers, ["Carro"]);
  var idxLinha = indiceHeaderEv_(headers, ["Linha"]);
  var idxPlaca = indiceHeaderEv_(headers, ["Placa"]);
  var idxHorario = indiceHeaderEv_(headers, ["Horário", "Horario"]);
  var idxMotorista = indiceHeaderEv_(headers, ["Motorista"]);
  var idxMatricula = indiceHeaderEv_(headers, ["Matrícula", "Matricula"]);
  var idxLocal = indiceHeaderEv_(headers, ["Local"]);
  var idxEvid = indiceHeaderEv_(headers, ["Evidenciado em"]);
  var idxUser = indiceHeaderEv_(headers, ["Usuário", "Usuario"]);

  var lastRow = sheet.getLastRow();
  var linhaAlvo = 0;
  var maxOrdem = 0;
  if (lastRow >= 2) {
    var valores = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    for (var r = 0; r < valores.length; r++) {
      var row = valores[r];
      if (idxOrdem >= 0) {
        var nOrd = Number(String(row[idxOrdem] || "").replace(/\D/g, ""));
        if (nOrd > maxOrdem) maxOrdem = nOrd;
      }
      var nNotif = idxNotif >= 0 ? String(row[idxNotif] || "").trim() : "";
      var nAuto = idxAuto >= 0 ? autoIdEv_(row[idxAuto]) : "";
      var bateNotif = !notificacao || nNotif === notificacao;
      var bateAuto = !autoId || nAuto === autoId;
      if (notificacao && autoId) {
        if (nNotif === notificacao && nAuto === autoId) linhaAlvo = r + 2;
      } else if (bateNotif && bateAuto && (notificacao || autoId)) {
        linhaAlvo = r + 2;
      }
    }
  }

  var acao = linhaAlvo ? "update" : "create";
  var linha;
  if (linhaAlvo) {
    linha = sheet.getRange(linhaAlvo, 1, 1, lastCol).getValues()[0];
  } else {
    linhaAlvo = lastRow + 1;
    if (linhaAlvo < 2) linhaAlvo = 2;
    linha = headers.map(function () { return ""; });
    if (idxOrdem >= 0) linha[idxOrdem] = maxOrdem + 1;
    if (idxRecebido >= 0) linha[idxRecebido] = hojeBrEv_();
  }

  function preencher(idx, valor, soVazio) {
    if (idx < 0) return;
    var v = valor == null ? "" : String(valor).trim();
    if (!v) return;
    if (soVazio && String(linha[idx] || "").trim()) return;
    linha[idx] = v;
  }

  preencher(idxNotif, notificacao, true);
  preencher(idxAuto, autoId, true);
  preencher(idxData, dados.data, true);
  preencher(idxMotivo, dados.motivo, true);
  preencher(idxAgente, dados.agente || dados.autuador, true);
  preencher(idxRecebido, dados.recebido || hojeBrEv_(), true);
  preencher(idxCarro, dados.carro, false);
  preencher(idxLinha, dados.linha, false);
  preencher(idxPlaca, dados.placa, false);
  preencher(idxHorario, dados.horario, false);
  preencher(idxMotorista, dados.motorista, false);
  preencher(idxMatricula, dados.matricula, false);
  preencher(idxLocal, dados.local, false);
  preencher(idxEvid, hojeBrEv_(), false);
  preencher(idxUser, dados.usuario, false);

  sheet.getRange(linhaAlvo, 1, 1, lastCol).setValues([linha]);

  return {
    status: "ok",
    ok: true,
    acao: acao,
    linha: linhaAlvo,
    notificacao: notificacao,
    auto: autoId,
    script_versao: SCRIPT_VERSAO
  };
}
