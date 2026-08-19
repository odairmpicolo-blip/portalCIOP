/**
 * Consulta do Decreto — Apps Script (deploy manual)
 *
 * O site já consulta o texto oficial em assets/data/decreto_context.txt.
 * Este script é opcional: se implantado, a página usa a IA quando o GET
 * responder JSON { resposta: "..." }.
 *
 * 1. Cole este arquivo num projeto em script.google.com.
 * 2. Propriedades: GEMINI_API_KEY (AI Studio).
 * 3. Implantar > App da Web > Executar como: Eu · Quem acessa: Qualquer pessoa.
 * 4. A URL /exec deve coincidir com APPS_SCRIPT_URL em assets/js/consulta-decreto.js.
 *
 * É obrigatório ter doGet: o navegador segue o redirecionamento do Apps Script
 * como GET. Sem doGet a página quebrava ("Função de script não encontrada: doGet").
 */

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"];
const DECRETO_URL = "https://www.portalciop.com.br/assets/data/decreto_context.txt";

function doGet(e) {
  return atender(e);
}

function doPost(e) {
  return atender(e);
}

function atender(e) {
  try {
    var pergunta = lerPergunta(e);
    if (!pergunta) return jsonOut({ erro: "Campo pergunta é obrigatório." });

    var key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!key) return jsonOut({ erro: "GEMINI_API_KEY não configurada no Apps Script." });

    var contexto = carregarDecreto_();
    var prompt = [
      "Você é um assistente da TCGL. Responda em português do Brasil, só com base no texto oficial abaixo.",
      "Se a informação não estiver no texto, diga que não consta. Cite artigos quando possível.",
      "Pergunta: " + pergunta,
      "Texto oficial:",
      contexto.slice(0, 28000)
    ].join("\n\n");

    var resultado = chamarGemini_(key, prompt);
    if (!resultado.texto) return jsonOut({ erro: resultado.erro || "Gemini não retornou texto." });
    return jsonOut({ resposta: resultado.texto });
  } catch (err) {
    return jsonOut({ erro: err.message || String(err) });
  }
}

function lerPergunta(e) {
  var q = "";
  if (e && e.parameter && e.parameter.pergunta) q = String(e.parameter.pergunta);
  if (!q && e && e.postData && e.postData.contents) {
    try {
      var body = JSON.parse(e.postData.contents);
      q = String(body.pergunta || body.prompt || "");
    } catch (ignore) {}
  }
  return q.trim();
}

function carregarDecreto_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get("decreto_txt");
  if (hit) return hit;
  var res = UrlFetchApp.fetch(DECRETO_URL, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error("Não foi possível ler o texto do decreto.");
  var txt = res.getContentText();
  cache.put("decreto_txt", txt.slice(0, 90000), 21600);
  return txt;
}

function chamarGemini_(key, prompt) {
  var payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
  };
  var ultimoErro = "Gemini não retornou texto.";
  for (var i = 0; i < GEMINI_MODELS.length; i++) {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/"
      + GEMINI_MODELS[i] + ":generateContent?key=" + encodeURIComponent(key);
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      try {
        var errJson = JSON.parse(res.getContentText());
        if (errJson.error && errJson.error.message) ultimoErro = errJson.error.message;
      } catch (ignore) {}
      continue;
    }
    var data = JSON.parse(res.getContentText());
    var parts = ((((data.candidates || [])[0] || {}).content || {}).parts) || [];
    var texto = parts.map(function (p) { return p.text || ""; }).join("").trim();
    if (texto) return { texto: texto, erro: "" };
  }
  return { texto: "", erro: ultimoErro };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
