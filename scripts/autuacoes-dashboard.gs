/**
 * Dashboard de Autuações TCGL — Web App (leitura)
 *
 * Colunas esperadas na planilha base:
 * Ordem, Data, Notificação, Auto, Motivo, Agente,
 * Grupo, Artigo, valor do auto em tarifas, valor em R$
 *
 * Publicar como Web App (Executar como: eu / Acesso: qualquer pessoa).
 * Teste de diagnóstico: ?debug=1
 */

const ABA_NOME = "AUTUAÇÕES";
const SCRIPT_VERSAO = "2026-06-22-mapeamento-valores";

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
    return respostaJson_(montarPayloadAutuacoes_());
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

function montarPayloadAutuacoes_() {
  var sheet = obterAbaAutuacoes_();
  var display = sheet.getDataRange().getDisplayValues();
  var bruto = sheet.getDataRange().getValues();

  if (!display.length) {
    return { status: "ok", total: 0, data: [], script_versao: SCRIPT_VERSAO };
  }

  var headers = display[0].map(function (h) { return String(h || "").trim(); });
  var idx = mapearIndices_(headers);
  var data = [];

  for (var i = 1; i < display.length; i++) {
    var linhaDisplay = display[i];
    var linhaBruto = bruto[i];
    if (!linhaTemConteudo_(linhaDisplay)) continue;

    var dataObj = parseDataLinha_(linhaBruto, linhaDisplay, idx.data);

    data.push({
      ordem: idx.ordem >= 0 ? linhaDisplay[idx.ordem] : i,
      data_iso: dataObj.iso,
      data_br: dataObj.br,
      notificacao: textoCelula_(linhaDisplay, idx.notificacao),
      auto: textoCelula_(linhaDisplay, idx.auto),
      motivo: textoCelula_(linhaDisplay, idx.motivo),
      agente: textoCelula_(linhaDisplay, idx.agente),
      grupo: textoCelula_(linhaDisplay, idx.grupo),
      artigo: textoCelula_(linhaDisplay, idx.artigo),
      valor_tarifas: numeroCelula_(linhaBruto, linhaDisplay, idx.valor_tarifas),
      valor_reais: numeroCelula_(linhaBruto, linhaDisplay, idx.valor_reais)
    });
  }

  return {
    status: "ok",
    total: data.length,
    script_versao: SCRIPT_VERSAO,
    data: data
  };
}

function obterAbaAutuacoes_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Abra o Apps Script a partir da planilha de autuações.");
  var sheet = ss.getSheetByName(ABA_NOME);
  if (!sheet) {
    var sheets = ss.getSheets();
    sheet = sheets.length ? sheets[0] : null;
  }
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
