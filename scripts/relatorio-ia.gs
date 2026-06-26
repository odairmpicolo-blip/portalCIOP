/**
 * Relatório IA — Apps Script (deploy manual)
 *
 * 1. Crie projeto em script.google.com e cole este arquivo.
 * 2. Em Propriedades do script, adicione GEMINI_API_KEY (chave do https://aistudio.google.com/apikey).
 * 3. Implantar > Nova implantação > App da Web > Executar como: Eu · Acesso: Qualquer pessoa.
 * 4. Copie a URL /exec para assets/data/portal-runtime.json → relatorioIaScriptUrl
 */

const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

function doGet() {
  return jsonOut({ ok: true, service: "relatorio-ia" });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const prompt = String(body.prompt || body.texto || "").trim();
    if (!prompt) return jsonOut({ ok: false, erro: "Campo prompt é obrigatório." });

    const key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!key) return jsonOut({ ok: false, erro: "GEMINI_API_KEY não configurada no Apps Script." });

    const resultado = chamarGemini_(key, prompt);
    if (!resultado.texto) return jsonOut({ ok: false, erro: resultado.erro || "Gemini não retornou texto." });

    return jsonOut({ ok: true, texto: resultado.texto });
  } catch (err) {
    return jsonOut({ ok: false, erro: err.message || String(err) });
  }
}

function chamarGemini_(key, prompt) {
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.35, maxOutputTokens: 2048 }
  };

  let ultimoErro = "Gemini não retornou texto.";

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];
    const url = "https://generativelanguage.googleapis.com/v1beta/models/"
      + model + ":generateContent?key=" + encodeURIComponent(key);
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      const errBody = res.getContentText();
      try {
        const errJson = JSON.parse(errBody);
        if (errJson.error && errJson.error.message) ultimoErro = errJson.error.message;
      } catch (ignore) {}
      continue;
    }
    const data = JSON.parse(res.getContentText());
    const parts = ((((data.candidates || [])[0] || {}).content || {}).parts) || [];
    const texto = parts.map(function (p) { return p.text || ""; }).join("").trim();
    if (texto) return { texto: texto, erro: "" };
  }
  return { texto: "", erro: ultimoErro };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
