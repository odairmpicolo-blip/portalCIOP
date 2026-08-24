/**
 * Importa o CSV diário Hitachi (Clever) do Gmail para a aba Clever.
 *
 * Projeto Apps Script da planilha:
 *   https://docs.google.com/spreadsheets/d/1Z_rFA-1jz7-kq4juGp5uFG4WMpVBloML98hDgWcX9gQ
 *
 * INSTALAÇÃO (conta planejamento@tcgl.com.br — a que recebe o e-mail das ~04:02)
 * 1. Extensões → Apps Script → arquivo deste nome (ou "importar relatórios do gmail")
 *    Substituir o conteúdo por este arquivo. NÃO colar em Código.gs / clever.gs.
 * 2. Salvar. Não pode existir outro onOpen neste arquivo.
 * 3. Executar uma vez: importarRelatorioTelemetriaDoGmail (autorizar Gmail).
 * 4. Na planilha: Portal CIOP → Instalar importação diária (Gmail) (~05:10).
 *
 * O Web App (doGet) continua em telemetria-planilha.gs / Código.gs.
 */

const GMAIL_IMPORT_VERSAO = "2026-08-24-gmail-csv-standalone";
const GMAIL_LABEL_IMPORTADO = "ciop-telemetria-importado";
const COLUNAS_IMPORT_CLEVER = [
  "Veiculo",
  "Data",
  "Inicio",
  "Fim",
  "Registros CAN",
  "Km Inicial",
  "Km Final",
  "Km Percorrido",
  "Consumo Combustivel (L)"
];

function gmailQueryTelemetria_() {
  return 'from:hitachirail-cd.com has:attachment newer_than:30d';
}

function menuImportarGmailTelemetria_() {
  var r = importarRelatorioTelemetriaDoGmail();
  SpreadsheetApp.getUi().alert("Telemetria", montarMsgImportacao_(r), SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuDebugGmailTelemetria_() {
  var r = debugImportacaoGmailTelemetria();
  SpreadsheetApp.getUi().alert("Diagnóstico Gmail", JSON.stringify(r, null, 2).slice(0, 1800), SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuColarCsvTelemetria_() {
  var html = HtmlService.createHtmlOutput(
    "<p>Cole o conteúdo do CSV Hitachi (Relatório Diário de Telemetria) e clique em Importar.</p>" +
    "<textarea id='csv' style='width:100%;height:260px;font:12px monospace'></textarea>" +
    "<p><button onclick=\"google.script.run.withSuccessHandler(function(m){document.getElementById('out').textContent=m;}).withFailureHandler(function(e){document.getElementById('out').textContent=e.message;}).importarCsvColado(document.getElementById('csv').value)\">Importar</button></p>" +
    "<pre id='out'></pre>"
  ).setWidth(520).setHeight(420);
  SpreadsheetApp.getUi().showModalDialog(html, "Importar CSV → aba Clever");
}

function menuInstalarTriggerGmailTelemetria_() {
  instalarTriggerGmailTelemetria_();
  SpreadsheetApp.getUi().alert(
    "Trigger diário instalado (~05:10, fuso da planilha), na conta que está logada agora. Tem que ser o Gmail que recebe o Hitachi."
  );
}

function importarCsvColado(texto) {
  var r = importarCsvNaAbaClever_(String(texto || ""), "colar");
  return montarMsgImportacao_(r);
}

/**
 * Trigger diário e menu. Relê e-mails Hitachi dos últimos 30 dias.
 * Não usa -label: e-mails já marcados entram de novo; linha repetida (veículo+data) é ignorada.
 */
function importarRelatorioTelemetriaDoGmail() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { ok: false, erro: "Outra importação está em andamento.", versao: GMAIL_IMPORT_VERSAO };
  }
  try {
    garantirLabelGmailTelemetria_();
    var threads = GmailApp.search(gmailQueryTelemetria_(), 0, 40);
    if (!threads.length) {
      return {
        ok: true,
        versao: GMAIL_IMPORT_VERSAO,
        emails: 0,
        arquivos: 0,
        inseridas: 0,
        ignoradas: 0,
        aviso: "Nenhum e-mail Hitachi com anexo nos últimos 30 dias nesta conta Gmail."
      };
    }
    var totalInseridas = 0;
    var totalIgnoradas = 0;
    var arquivos = 0;
    var detalhes = [];
    var avisos = [];
    threads.forEach(function (thread) {
      var processouCsv = false;
      thread.getMessages().forEach(function (msg) {
        listarTextosCsvDoEmail_(msg).forEach(function (item) {
          arquivos += 1;
          processouCsv = true;
          var r = importarCsvNaAbaClever_(item.texto, item.nome);
          totalInseridas += r.inseridas || 0;
          totalIgnoradas += r.ignoradas || 0;
          detalhes.push(item.nome + ": +" + r.inseridas + " (já havia " + r.ignoradas + ")");
          if (r.aviso) avisos.push(item.nome + ": " + r.aviso);
        });
      });
      if (processouCsv) {
        thread.addLabel(GmailApp.getUserLabelByName(GMAIL_LABEL_IMPORTADO));
      } else {
        var nomes = [];
        thread.getMessages().forEach(function (msg) {
          msg.getAttachments().forEach(function (att) {
            nomes.push(att.getName() || att.getContentType() || "(sem nome)");
          });
        });
        avisos.push("Sem CSV: " + (nomes.join(", ") || "anexo ilegível") + " · " + (thread.getFirstMessageSubject() || ""));
      }
    });
    gmailCleverInvalidarCache_();
    return {
      ok: true,
      versao: GMAIL_IMPORT_VERSAO,
      emails: threads.length,
      arquivos: arquivos,
      inseridas: totalInseridas,
      ignoradas: totalIgnoradas,
      detalhes: detalhes,
      aviso: avisos.length ? avisos.join("\n") : ""
    };
  } finally {
    lock.releaseLock();
  }
}

function debugImportacaoGmailTelemetria() {
  var threads = GmailApp.search(gmailQueryTelemetria_(), 0, 12);
  var itens = threads.map(function (thread) {
    var atts = [];
    thread.getMessages().forEach(function (msg) {
      msg.getAttachments().forEach(function (att) {
        atts.push({
          nome: att.getName() || "",
          tipo: att.getContentType() || "",
          bytes: att.getSize()
        });
      });
    });
    var labels = thread.getLabels().map(function (l) { return l.getName(); });
    return {
      assunto: thread.getFirstMessageSubject() || "",
      data: thread.getLastMessageDate() ? thread.getLastMessageDate().toISOString() : "",
      labels: labels,
      anexos: atts
    };
  });
  return {
    ok: true,
    versao: GMAIL_IMPORT_VERSAO,
    query: gmailQueryTelemetria_(),
    conta: Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || "",
    emails: itens.length,
    itens: itens
  };
}

function instalarTriggerGmailTelemetria_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "importarRelatorioTelemetriaDoGmail") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("importarRelatorioTelemetriaDoGmail")
    .timeBased()
    .everyDays(1)
    .atHour(5)
    .nearMinute(10)
    .create();
}

function garantirLabelGmailTelemetria_() {
  if (!GmailApp.getUserLabelByName(GMAIL_LABEL_IMPORTADO)) {
    GmailApp.createLabel(GMAIL_LABEL_IMPORTADO);
  }
}

function montarMsgImportacao_(r) {
  if (!r || r.ok === false) return "Falha: " + (r && r.erro ? r.erro : "desconhecida");
  var linhas = [
    "Versão: " + (r.versao || GMAIL_IMPORT_VERSAO),
    "E-mails: " + (r.emails != null ? r.emails : "—"),
    "Arquivos: " + (r.arquivos != null ? r.arquivos : "—"),
    "Linhas novas na aba Clever: " + (r.inseridas || 0),
    "Já existiam (ignoradas): " + (r.ignoradas || 0)
  ];
  if (r.aviso) linhas.push("", r.aviso);
  if (r.detalhes && r.detalhes.length) linhas.push("", r.detalhes.join("\n"));
  return linhas.join("\n");
}

function listarTextosCsvDoEmail_(msg) {
  var saida = [];
  msg.getAttachments().forEach(function (att) {
    var nome = att.getName() || "";
    var tipo = String(att.getContentType() || "").toLowerCase();
    if (/\.zip$/i.test(nome) || tipo.indexOf("zip") >= 0) {
      try {
        Utilities.unzip(att.copyBlob()).forEach(function (blob) {
          var inner = blob.getName() || "anexo.csv";
          if (!/\.csv$/i.test(inner) && !pareceCsvTelemetria_(blob.getDataAsString("UTF-8"))) return;
          saida.push({ nome: nome + "/" + inner, texto: decodificarCsv_(blob) });
        });
      } catch (err) {
        saida.push({ nome: nome, texto: "", erro: String(err) });
      }
      return;
    }
    var texto = decodificarCsv_(att);
    if (/\.csv$/i.test(nome) || tipo.indexOf("csv") >= 0 || pareceCsvTelemetria_(texto)) {
      saida.push({ nome: nome || "anexo.csv", texto: texto });
    }
  });
  return saida.filter(function (item) { return item.texto && pareceCsvTelemetria_(item.texto); });
}

function decodificarCsv_(blobOuAtt) {
  var utf = "";
  try { utf = blobOuAtt.getDataAsString("UTF-8") || ""; } catch (e1) { utf = ""; }
  if (utf.charCodeAt(0) === 0xfeff) utf = utf.slice(1);
  if (pareceCsvTelemetria_(utf)) return utf;
  var latin = "";
  try { latin = blobOuAtt.getDataAsString("ISO-8859-1") || ""; } catch (e2) { latin = ""; }
  if (latin.charCodeAt(0) === 0xfeff) latin = latin.slice(1);
  return pareceCsvTelemetria_(latin) ? latin : (utf || latin);
}

function pareceCsvTelemetria_(texto) {
  var head = String(texto || "").slice(0, 400).toLowerCase();
  if (!head) return false;
  return head.indexOf("veiculo") >= 0 || head.indexOf("vehicle") >= 0 || head.indexOf("cliente") >= 0;
}

function parseCsvTelemetria_(texto) {
  var t = String(texto || "").replace(/^\uFEFF/, "");
  var matriz = Utilities.parseCsv(t);
  if (matriz && matriz[0] && matriz[0].length === 1 && String(matriz[0][0]).indexOf(";") >= 0) {
    matriz = Utilities.parseCsv(t, ";");
  }
  return matriz;
}

function importarCsvNaAbaClever_(texto, origem) {
  var sheet = gmailCleverAba_();
  if (!sheet) throw new Error("Aba Clever não encontrada.");
  var matriz = parseCsvTelemetria_(texto);
  if (!matriz || matriz.length < 2) {
    return { ok: true, inseridas: 0, ignoradas: 0, origem: origem, aviso: "CSV vazio." };
  }
  var headerIdx = gmailCleverHeaderIdx_(matriz);
  var headersCsv = (matriz[headerIdx] || []).map(function (h) { return String(h || "").trim(); });
  if (!headersCsv.some(function (h) { return /veiculo|vehicle/i.test(String(h || "")); })) {
    return { ok: true, inseridas: 0, ignoradas: 0, origem: origem, aviso: "Cabeçalho do CSV não reconhecido." };
  }
  var idxPorColuna = {};
  headersCsv.forEach(function (h, i) {
    var col = gmailCleverColuna_(h) || h;
    idxPorColuna[gmailCleverNormChave_(col)] = i;
    idxPorColuna[gmailCleverNormChave_(h)] = i;
  });

  function valorCsv_(aliases, linha) {
    for (var i = 0; i < aliases.length; i++) {
      var idx = idxPorColuna[gmailCleverNormChave_(aliases[i])];
      if (idx == null) continue;
      var v = linha[idx];
      if (v != null && String(v).trim() !== "") return v;
    }
    return "";
  }

  var existentes = chavesExistentesClever_(sheet);
  var novas = [];
  var ignoradas = 0;
  var semChave = 0;
  for (var r = headerIdx + 1; r < matriz.length; r++) {
    var linha = matriz[r] || [];
    if (!linha.some(function (c) { return gmailCleverPreenchido_(c); })) continue;
    var veiculo = gmailCleverVeiculo_(valorCsv_(["Veiculo", "vehicle id", "vehicle"], linha));
    var dataIso = gmailCleverDataIso_(valorCsv_(["Data", "date"], linha));
    if (!veiculo || !dataIso) {
      semChave += 1;
      continue;
    }
    var chave = dataIso + "|" + veiculo;
    if (existentes[chave]) {
      ignoradas += 1;
      continue;
    }
    existentes[chave] = true;
    var inicioBruto = valorCsv_(["Inicio", "start time local"], linha);
    var fimBruto = valorCsv_(["Fim", "end time local"], linha);
    novas.push([
      veiculo,
      dataIso,
      formatarDataHoraPlanilha_(inicioBruto),
      formatarDataHoraPlanilha_(fimBruto),
      paraNumeroOuVazio_(valorCsv_(["Registros CAN", "number of events"], linha)),
      paraNumeroOuVazio_(valorCsv_(["Km Inicial", "start distance"], linha)),
      paraNumeroOuVazio_(valorCsv_(["Km Final", "end distance"], linha)),
      paraNumeroOuVazio_(valorCsv_(["Km Percorrido", "daily distance"], linha)),
      paraNumeroOuVazio_(valorCsv_(["Consumo Combustivel (L)", "daily fuel consumption l"], linha))
    ]);
  }

  if (novas.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, novas.length, COLUNAS_IMPORT_CLEVER.length).setValues(novas);
  }
  gmailCleverInvalidarCache_();
  var aviso = semChave ? (semChave + " linha(s) sem veículo/data.") : "";
  return { ok: true, inseridas: novas.length, ignoradas: ignoradas, origem: origem || "", aviso: aviso };
}

function chavesExistentesClever_(sheet) {
  var last = sheet.getLastRow();
  var set = {};
  if (last < 2) return set;
  var vals = sheet.getRange(2, 1, last - 1, 2).getDisplayValues();
  vals.forEach(function (r) {
    var v = gmailCleverVeiculo_(r[0]);
    var d = gmailCleverDataIso_(r[1]);
    if (v && d) set[d + "|" + v] = true;
  });
  return set;
}

function formatarDataHoraPlanilha_(val) {
  var s = String(val || "").trim();
  if (!s) return "";
  var m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2) +
      " " + ("0" + m[4]).slice(-2) + ":" + ("0" + m[5]).slice(-2) + ":" + ("0" + (m[6] || "00")).slice(-2);
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return m[1] + "-" + m[2] + "-" + m[3] + " " +
      ("0" + m[4]).slice(-2) + ":" + ("0" + m[5]).slice(-2) + ":" + ("0" + (m[6] || "00")).slice(-2);
  }
  return s;
}

function paraNumeroOuVazio_(val) {
  if (!gmailCleverPreenchido_(val)) return "";
  var n = gmailCleverNumero_(val);
  return isNaN(n) ? String(val).trim() : n;
}

function gmailCleverAba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Clever");
  if (sheet) return sheet;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (gmailCleverNormChave_(sheets[i].getName()) === "clever") return sheets[i];
  }
  return null;
}

function gmailCleverInvalidarCache_() {
  try {
    PropertiesService.getScriptProperties().setProperty("telemetria_cache_v", String(Date.now()));
  } catch (err) {}
}

function gmailCleverNormChave_(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function gmailCleverHeaderIdx_(linhas) {
  for (var i = 0; i < Math.min(linhas.length, 12); i++) {
    var textos = (linhas[i] || []).map(function (c) { return gmailCleverNormChave_(c); });
    if (textos.some(function (t) { return t === "veiculo" || t === "vehicle id" || t.indexOf("veiculo") >= 0; })) {
      return i;
    }
  }
  return 0;
}

function gmailCleverColuna_(nome) {
  var original = String(nome || "").trim();
  if (!original) return null;
  var chave = gmailCleverNormChave_(original);
  var mapa = {
    "vehicle id": "Veiculo",
    "date": "Data",
    "start time local": "Inicio",
    "end time local": "Fim",
    "number of events": "Registros CAN",
    "start distance": "Km Inicial",
    "end distance": "Km Final",
    "daily distance": "Km Percorrido",
    "daily fuel consumption l": "Consumo Combustivel (L)"
  };
  return mapa[chave] || original;
}

function gmailCleverVeiculo_(v) {
  var s = String(v || "").trim();
  if (!s) return "";
  var digits = s.replace(/\D/g, "");
  if (digits) return String(parseInt(digits, 10));
  return s.toUpperCase();
}

function gmailCleverDataIso_(val) {
  var s = String(val || "").trim();
  if (!s) return "";
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + "-" + m[2] + "-" + m[3];
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  return "";
}

function gmailCleverNumero_(val) {
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
  }
  var n = Number(normalized);
  return isNaN(n) ? NaN : n;
}

function gmailCleverPreenchido_(v) {
  var s = String(v != null ? v : "").trim();
  if (!s) return false;
  var low = s.toLowerCase();
  return ["-", "—", "n/a", "na", "null", "undefined", "#n/a"].indexOf(low) < 0;
}
