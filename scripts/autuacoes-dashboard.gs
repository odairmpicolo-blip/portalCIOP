/**
 * Dashboard de Autuações TCGL — Web App (leitura)
 *
 * Colunas esperadas na planilha base:
 * Ordem, Data, Notificação, Auto, Motivo, Agente,
 * Grupo, Artigo, valor do auto em tarifas, valor em R$
 *
 * Publicar como Web App (Executar como: eu / Acesso: qualquer pessoa).
 * Cole este código no Apps Script vinculado à planilha de autuações
 * e reimplante mantendo a URL usada em autuacoes.html.
 */

const ABA_NOME = "AUTUAÇÕES";

const MAPA_COLUNAS = {
  ordem: ["ordem", "Ordem", "ORDEM"],
  data: ["Data", "DATA", "data", "Data da autuação"],
  notificacao: ["Notificação Nº", "Notificacao Nº", "NOTIFICAÇÃO", "Notificação", "notificacao"],
  auto: ["Auto de Infração Nº", "Auto de Infracao Nº", "AUTO", "Auto", "auto"],
  motivo: ["Motivo", "MOTIVO", "motivo"],
  agente: ["Agente", "AGENTE", "agente"],
  grupo: ["Grupo", "GRUPO", "grupo"],
  artigo: ["Artigo", "ARTIGO", "artigo"],
  valor_tarifas: ["valor do auto em tarifas", "Valor do auto em tarifas", "TARIFAS", "Tarifas"],
  valor_reais: ["valor em R$", "Valor em R$", "VALOR R$", "Valor R$"]
};

function doGet() {
  try {
    const payload = montarPayloadAutuacoes_();
    return respostaJson_(payload);
  } catch (error) {
    return respostaJson_({
      status: "error",
      message: String(error && error.message ? error.message : error)
    });
  }
}

function montarPayloadAutuacoes_() {
  const sheet = obterAbaAutuacoes_();
  const valores = sheet.getDataRange().getDisplayValues();
  if (!valores.length) {
    return { status: "ok", total: 0, data: [] };
  }

  const headers = valores[0].map(function (h) { return String(h || "").trim(); });
  const idx = mapearIndices_(headers);
  const data = [];

  for (var i = 1; i < valores.length; i++) {
    var linha = valores[i];
    if (!linha || !linha.some(function (c) { return String(c || "").trim(); })) continue;

    var brutoData = idx.data >= 0 ? linha[idx.data] : "";
    var dataObj = parseData_(brutoData, sheet, i + 1, idx.data + 1);

    data.push({
      ordem: idx.ordem >= 0 ? linha[idx.ordem] : i,
      data_iso: dataObj.iso,
      data_br: dataObj.br,
      notificacao: idx.notificacao >= 0 ? linha[idx.notificacao] : "",
      auto: idx.auto >= 0 ? linha[idx.auto] : "",
      motivo: idx.motivo >= 0 ? linha[idx.motivo] : "",
      agente: idx.agente >= 0 ? linha[idx.agente] : "",
      grupo: idx.grupo >= 0 ? linha[idx.grupo] : "",
      artigo: idx.artigo >= 0 ? linha[idx.artigo] : "",
      valor_tarifas: idx.valor_tarifas >= 0 ? parseNumero_(linha[idx.valor_tarifas]) : 0,
      valor_reais: idx.valor_reais >= 0 ? parseNumero_(linha[idx.valor_reais]) : 0
    });
  }

  return {
    status: "ok",
    total: data.length,
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

function normalizarCabecalho_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseData_(texto, sheet, row, col) {
  if (col > 0) {
    try {
      var cell = sheet.getRange(row, col);
      var valor = cell.getValue();
      if (valor instanceof Date && !isNaN(valor.getTime())) {
        return formatarData_(valor);
      }
    } catch (e) {}
  }
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
