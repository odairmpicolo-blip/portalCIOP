/**
 * Folha de Serviço — Web App (leitura + lançamento)
 *
 * Planilha: https://docs.google.com/spreadsheets/d/1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA
 * Lançamentos (dados): gid 1013912232
 * Listas padronizadas: gid 665133219 (aba DADOS / referência)
 *
 * GET ?somente_opcoes=1     → { ok, opcoes }
 * GET ?somente_recentes=1  → { ok, dados } (últimos N lançamentos, leitura rápida)
 * GET ?data=YYYY-MM-DD      → filtra registros por data
 * POST action=create|update
 */

const SPREADSHEET_ID = "1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA";
const ABA_GID = 1013912232;
const ABA_NOME = "FOLHA DE SERVIÇO";
const LISTAS_GID = 665133219;
const SCRIPT_VERSAO = "2026-06-22-perf-dashboard";
const FOLHA_DASHBOARD_DIAS = 90;
const FOLHA_CHUNK_LINHAS = 800;
const FOLHA_CACHE_TTL = 600;

/** Colunas da aba DADOS (gid 665133219) — listas verticais por coluna */
const COLUNAS_LISTAS = {
  analista: 1,              // A — ANALISTA (RG)
  mot_sai: 6,               // F — MOTORISTAS
  mot_entra: 6,             // F
  carro_sai: 7,             // G — CARROS
  carro_entra: 7,           // G
  linha: 8,                 // H — LINHAS
  ocorrencia: 12,           // L — OCORRÊNCIA
  local: 18,                // R — LOCAIS
  motivo_oficina: 23,       // W — INFORMAÇÕES DA OFICINA
  tempo_deslocamento: 24,   // X — TEMPO EM MIN DE SOS OFICINA
  mecanico: 25,             // Y — MECÂNICOS
  situacao: 26              // Z — SITUAÇAO
};

/** Cabeçalhos esperados na linha 1 (validação da aba correta) */
const CABECALHOS_LISTAS = {
  1: ["analista"],
  6: ["motorista", "motoristas"],
  7: ["carro", "carros"],
  8: ["linha", "linhas"],
  12: ["ocorrencia", "ocorrência"],
  18: ["local", "locais"],
  23: ["informacoes", "oficina"],
  24: ["tempo"],
  25: ["mecanico", "mecânicos"],
  26: ["situacao", "situação", "situacao"]
};

const CAMPOS_OPCOES = [
  "ocorrencia", "analista", "carro_sai", "mot_sai", "carro_entra", "mot_entra",
  "linha", "motivo_oficina", "local", "mecanico", "situacao", "tempo_deslocamento"
];

const ALIAS_COLUNAS = {
  ocorrencia: ["ocorrencia", "ocorrência"],
  analista: ["analista"],
  carro_sai: ["carro_sai", "carro sai", "carro que sai"],
  mot_sai: ["mot_sai", "mot sai", "mot que sai", "mot. que sai"],
  carro_entra: ["carro_entra", "carro entra", "carro que entra"],
  mot_entra: ["mot_entra", "mot entra", "mot que entra", "mot. que entra"],
  linha: ["linha"],
  motivo_oficina: ["motivo_oficina", "motivo oficina", "motivo somente oficina", "motivo"],
  local: ["local"],
  mecanico: ["mecanico", "mecânico"],
  situacao: ["situacao", "situação"],
  tempo_deslocamento: ["tempo_deslocamento", "tempo deslocamento", "tempo de deslocamento da oficina"]
};

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (String(params.liberacao || "") === "1") {
      return json_(montarRespostaLiberacaoGet_(params));
    }
  if (String(params.somente_opcoes || "") === "1") {
    const opcoes = lerOpcoesPadronizadas_();
    return json_({
      ok: true,
      opcoes: opcoes,
      meta: metaListas_(opcoes)
    });
  }
  if (String(params.somente_recentes || "") === "1") {
    const limit = parseInt(params.limit || "10", 10);
    return json_({
      ok: true,
      dados: lerUltimosRegistros_(limit),
      meta: { versao: SCRIPT_VERSAO, origem: "somente_recentes", limit: limit }
    });
  }
  if (String(params.dashboard || "") === "1") {
    return json_(montarRespostaDashboard_(params));
  }
  return json_(montarRespostaLeitura_(params));
  } catch (err) {
    return json_({ ok: false, erro: err.message || String(err) });
  }
}

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    if (String(params.liberacao || "") === "1") {
      return json_(montarRespostaLiberacaoPost_(params));
    }
    const action = String(params.action || "create").toLowerCase();
    if (action === "update") return json_(atualizarRegistro_(params));
    return json_(criarRegistro_(params));
  } catch (err) {
    return json_({ ok: false, erro: err.message || String(err) });
  }
}

function montarRespostaLeitura_(params) {
  const filtroData = normalizarDataIso_(params.data || "");
  const limit = parseInt(params.limit || "0", 10);
  const sheet = abrirAba_();
  const valores = sheet.getDataRange().getValues();
  if (valores.length < 2) {
    return { ok: true, dados: [], opcoes: lerOpcoesPadronizadas_() };
  }

  const cabecalho = valores[0].map(normalizarChave_);
  const dados = [];

  for (let i = 1; i < valores.length; i++) {
    const item = linhaParaObjeto_(cabecalho, valores[i], i + 1);
    if (filtroData && normalizarDataIso_(item.data) !== filtroData) continue;
    dados.push(item);
  }

  if (limit > 0 && dados.length > limit) {
    dados.splice(0, dados.length - limit);
  }

  return { ok: true, dados: dados, opcoes: lerOpcoesPadronizadas_() };
}

/** Leitura enxuta para o dashboard (menos campos, janela recente). */
function montarRespostaDashboard_(params) {
  params = params || {};
  var dias = Math.max(30, Math.min(parseInt(params.dias || String(FOLHA_DASHBOARD_DIAS), 10) || FOLHA_DASHBOARD_DIAS, 730));
  var dataMinIso = isoDataDiasAtrasFolha_(dias);
  var cacheKey = "folha-dash-" + SCRIPT_VERSAO + "-" + dias;
  try {
    var emCache = CacheService.getScriptCache().get(cacheKey);
    if (emCache) {
      var parsed = JSON.parse(emCache);
      parsed.meta = parsed.meta || {};
      parsed.meta.cache = true;
      return parsed;
    }
  } catch (errCache) {}

  const sheet = abrirAba_();
  const lastRow = sheet.getLastRow();
  const numCols = sheet.getLastColumn();
  const totalPlanilha = Math.max(0, lastRow - 1);
  if (lastRow < 2 || numCols < 1) {
    return {
      ok: true,
      dados: [],
      meta: { versao: SCRIPT_VERSAO, origem: "dashboard", total: 0, total_planilha: 0, dias: dias, data_de: dataMinIso }
    };
  }

  const titulos = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  const cabecalho = titulos.map(normalizarChave_);
  const dados = [];
  var endRow = lastRow;

  while (endRow >= 2) {
    var startRow = Math.max(2, endRow - FOLHA_CHUNK_LINHAS + 1);
    var numRows = endRow - startRow + 1;
    var valores = sheet.getRange(startRow, 1, numRows, numCols).getValues();
    var parar = false;

    for (var i = valores.length - 1; i >= 0; i--) {
      var bruto = linhaParaObjeto_(cabecalho, valores[i], startRow + i);
      var iso = normalizarDataIso_(bruto.data);
      if (dataMinIso && iso && iso < dataMinIso) {
        parar = true;
        break;
      }
      dados.push(objetoDashboardSlim_(bruto));
    }

    if (parar) break;
    endRow = startRow - 1;
  }

  var payload = {
    ok: true,
    dados: dados,
    meta: {
      versao: SCRIPT_VERSAO,
      origem: "dashboard",
      total: dados.length,
      total_planilha: totalPlanilha,
      dias: dias,
      data_de: dataMinIso,
      cache: false
    }
  };
  try {
    CacheService.getScriptCache().put(cacheKey, JSON.stringify(payload), FOLHA_CACHE_TTL);
  } catch (errPut) {}
  return payload;
}

function isoDataDiasAtrasFolha_(dias) {
  var d = new Date();
  d.setDate(d.getDate() - dias);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function objetoDashboardSlim_(item) {
  return {
    data: item.data || "",
    hora: item.hora || "",
    ocorrencia: item.ocorrencia || "",
    analista: item.analista || "",
    carro_que_sai: item.carro_que_sai || "",
    mot_que_sai: item.mot_que_sai || "",
    motivo_somente_oficina: item.motivo_somente_oficina || "",
    linha: item.linha || "",
    situacao: item.situacao || ""
  };
}

function lerUltimosRegistros_(quantidade) {
  const sheet = abrirAba_();
  const lastRow = sheet.getLastRow();
  const numCols = sheet.getLastColumn();
  if (lastRow < 2 || numCols < 1) return [];

  const qtd = Math.max(1, Math.min(parseInt(quantidade || "10", 10) || 10, 100));
  const numRows = Math.min(qtd, lastRow - 1);
  const startRow = lastRow - numRows + 1;
  const titulos = sheet.getRange(1, 1, 1, numCols).getValues()[0];
  const cabecalho = titulos.map(normalizarChave_);
  const valores = sheet.getRange(startRow, 1, numRows, numCols).getValues();
  const dados = [];

  for (let i = 0; i < valores.length; i++) {
    dados.push(linhaParaObjeto_(cabecalho, valores[i], startRow + i));
  }

  dados.reverse();
  return dados;
}

function lerOpcoesPadronizadas_() {
  const sheet = abrirAbaListas_();
  const opcoes = {};
  const lidas = {};

  CAMPOS_OPCOES.forEach(function (campo) {
    const col = COLUNAS_LISTAS[campo];
    if (!col) {
      opcoes[campo] = [];
      return;
    }
    if (!lidas[col]) {
      lidas[col] = valoresUnicosColunaIndice_(sheet, col);
    }
    opcoes[campo] = lidas[col].slice();
  });

  CAMPOS_OPCOES.forEach(function (campo) {
    opcoes[campo].sort(function (a, b) {
      return String(a).localeCompare(String(b), "pt-BR", { numeric: true });
    });
  });

  return opcoes;
}

function metaListas_(opcoes) {
  const sheet = abrirAbaListas_();
  const contagens = {};
  CAMPOS_OPCOES.forEach(function (campo) {
    contagens[campo] = (opcoes[campo] || []).length;
  });
  return {
    versao: SCRIPT_VERSAO,
    listas_gid: LISTAS_GID,
    listas_aba: sheet.getName(),
    ocorrencia_amostra: (opcoes.ocorrencia || []).slice(0, 5),
    contagens: contagens
  };
}

function abrirAbaListas_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === LISTAS_GID) {
      validarCabecalhosListas_(sheets[i]);
      return sheets[i];
    }
  }
  throw new Error("Aba de listas gid " + LISTAS_GID + " não encontrada na planilha.");
}

function validarCabecalhosListas_(sheet) {
  const cabecalho = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const chaves = Object.keys(CABECALHOS_LISTAS);
  for (let i = 0; i < chaves.length; i++) {
    const col = Number(chaves[i]);
    const titulo = normalizarChave_(cabecalho[col - 1] || "");
    const esperados = CABECALHOS_LISTAS[col];
    const ok = esperados.some(function (parte) {
      return titulo.indexOf(normalizarChave_(parte)) >= 0;
    });
    if (!ok) {
      throw new Error(
        "Aba gid " + LISTAS_GID + " (" + sheet.getName() + "): coluna " +
        colLetra_(col) + " deveria ser lista de referência, mas o cabeçalho é \"" +
        String(cabecalho[col - 1] || "") + "\"."
      );
    }
  }
}

function colLetra_(col) {
  let n = col;
  let letra = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - 1) / 26);
  }
  return letra;
}

function ultimaLinhaColuna_(sheet, colIndex) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const numRows = lastRow - 1;
  const valores = lerColuna_(sheet, colIndex, 2, numRows);
  for (let i = valores.length - 1; i >= 0; i--) {
    const t = String(valores[i] == null ? "" : valores[i]).trim();
    if (t && t !== "-") return i + 2;
  }
  return 1;
}

/** getRange(linha, col, numLinhas, numColunas) — não confundir com intervalo A1 */
function lerColuna_(sheet, colIndex, startRow, numRows) {
  if (numRows < 1) return [];
  return sheet.getRange(startRow, colIndex, numRows, 1).getValues().flat();
}

function valoresUnicosColunaIndice_(sheet, colIndex) {
  const ultima = ultimaLinhaColuna_(sheet, colIndex);
  if (ultima < 2) return [];
  const numRows = ultima - 1;
  const valores = lerColuna_(sheet, colIndex, 2, numRows);
  const unicos = {};
  valores.forEach(function (v) {
    const t = String(v == null ? "" : v).trim();
    if (!t || t === "-") return;
    unicos[t] = true;
  });
  return Object.keys(unicos);
}

function mapearColunaParaCampo_(titulo) {
  const chave = normalizarChave_(titulo);
  for (let i = 0; i < CAMPOS_OPCOES.length; i++) {
    const campo = CAMPOS_OPCOES[i];
    const aliases = [campo].concat(ALIAS_COLUNAS[campo] || []).map(normalizarChave_);
    if (aliases.indexOf(chave) >= 0) return campo;
  }
  return "";
}

function criarRegistro_(params) {
  const sheet = abrirAba_();
  const titulos = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const linha = titulos.map(function (titulo) {
    return valorGravacaoColuna_(titulo, params);
  });
  sheet.appendRow(linha);
  return { ok: true, linha: sheet.getLastRow(), acao: "create" };
}

function atualizarRegistro_(params) {
  const row = Number(params._row || params.rowNumber || params.linhaPlanilha);
  if (!row || row < 2) throw new Error("Linha da planilha inválida para atualização.");

  const sheet = abrirAba_();
  const titulos = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const valoresAtuais = sheet.getRange(row, 1, 1, titulos.length).getValues()[0];

  titulos.forEach(function (titulo, idx) {
    const chave = normalizarChave_(titulo);
    const campo = mapearColunaParaCampo_(titulo);
    if (params[chave] !== undefined || (campo && params[campo] !== undefined)) {
      valoresAtuais[idx] = valorGravacaoColuna_(titulo, params);
    }
  });

  sheet.getRange(row, 1, 1, titulos.length).setValues([valoresAtuais]);
  return { ok: true, linha: row, acao: "update" };
}

/** Converte parâmetros do formulário (carro_sai) para colunas da planilha (CARRO QUE SAI). */
function valorGravacaoColuna_(titulo, params) {
  const chave = normalizarChave_(titulo);
  let valor = "";

  if (Object.prototype.hasOwnProperty.call(params, chave)) {
    valor = params[chave];
  } else {
    const campo = mapearColunaParaCampo_(titulo);
    if (campo && Object.prototype.hasOwnProperty.call(params, campo)) {
      valor = params[campo];
    }
  }

  valor = valor == null ? "" : String(valor).trim();
  if (chave === "data" && valor) {
    valor = formatarDataPlanilha_(valor);
  }
  return valor;
}

function formatarDataPlanilha_(valor) {
  const iso = normalizarDataIso_(valor);
  if (!iso) return valor;
  const p = iso.split("-");
  if (p.length !== 3) return valor;
  return p[2] + "/" + p[1] + "/" + p[0];
}

function abrirAba_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === ABA_GID) return sheets[i];
  }

  const porNome = ss.getSheetByName(ABA_NOME);
  if (porNome) return porNome;

  const nomes = sheets.map(function (s) { return s.getName(); }).join(", ");
  throw new Error('Aba gid ' + ABA_GID + ' / "' + ABA_NOME + '" não encontrada. Abas: ' + nomes);
}

function linhaParaObjeto_(cabecalho, valores, rowNumber) {
  const item = { _row: rowNumber };
  cabecalho.forEach(function (chave, idx) {
    if (!chave) return;
    item[chave] = valorCelulaParaJson_(valores[idx], chave);
  });
  if (item.data) {
    item.data = normalizarDataIso_(item.data) || item.data;
  }
  if (item.hora) {
    item.hora = formatarHoraPlanilha_(item.hora);
  }
  return item;
}

function valorCelulaParaJson_(valor, chave) {
  if (valor == null || valor === "") return "";
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) {
    const tz = Session.getScriptTimeZone();
    if (chave === "data") {
      return Utilities.formatDate(valor, tz, "yyyy-MM-dd");
    }
    if (chave === "hora") {
      return Utilities.formatDate(valor, tz, "HH:mm");
    }
  }
  return String(valor).trim();
}

function formatarHoraPlanilha_(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "HH:mm");
  }
  const texto = String(valor || "").trim();
  if (!texto) return "";
  const hm = texto.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    return ("0" + hm[1]).slice(-2) + ":" + hm[2];
  }
  const num = Number(texto);
  if (!isNaN(num) && num >= 0 && num < 1) {
    const totalMin = Math.round(num * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2);
  }
  return texto;
}

function normalizarChave_(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizarDataIso_(valor) {
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

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
