(function () {
  var APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyZq6C3GCHBmDOE6OK1cseTD8qXx450BPcNLtWKBn7yBJegM6jx7zQxTiE1VR2Nwu7L/exec";
  var DECRETO_URL = "../assets/data/decreto_context.txt";
  var STOP = {
    a: 1, ao: 1, aos: 1, as: 1, ate: 1, com: 1, como: 1, da: 1, das: 1, de: 1, do: 1, dos: 1,
    e: 1, em: 1, entre: 1, essa: 1, esse: 1, este: 1, esta: 1, eu: 1, ha: 1, isso: 1, la: 1,
    me: 1, na: 1, nas: 1, no: 1, nos: 1, o: 1, os: 1, ou: 1, para: 1, pela: 1, pelo: 1, por: 1,
    qual: 1, quais: 1, que: 1, se: 1, sao: 1, ser: 1, seu: 1, sua: 1, um: 1, uma: 1, uns: 1,
    art: 1, artigo: 1, artigos: 1, decreto: 1, decretos: 1, sobre: 1, alguma: 1, algo: 1
  };

  var form = document.getElementById("aiChatForm");
  var input = document.getElementById("aiChatInput");
  var sendBtn = document.getElementById("aiChatSend");
  var log = document.getElementById("aiChatLog");
  var decretoTexto = "";
  var decretoPartes = [];
  var carregandoDecreto = null;

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  function addUserMsg(texto) {
    var div = document.createElement("div");
    div.className = "ai-chat-msg ai-chat-user";
    div.textContent = texto;
    log.appendChild(div);
    scrollToEnd();
  }

  function addBotTyping() {
    var wrap = document.createElement("div");
    wrap.className = "ai-chat-msg ai-chat-bot";
    wrap.innerHTML = '<span class="ai-chat-avatar"><svg viewBox="0 0 24 24"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"/></svg></span>' +
      '<span class="ai-chat-typing"><span></span><span></span><span></span></span>';
    log.appendChild(wrap);
    scrollToEnd();
    return wrap;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function mdToHtml(texto) {
    var lines = escapeHtml(texto).replace(/\r\n/g, "\n").split("\n");
    var html = "";
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].trim();
      var bulletMatch = /^[-*]\s+(.*)$/.exec(trimmed);
      var quoteMatch = /^&gt;\s?(.*)$/.exec(trimmed);
      if (bulletMatch) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += "<li>" + inline(bulletMatch[1]) + "</li>";
        continue;
      }
      if (inList) { html += "</ul>"; inList = false; }
      if (quoteMatch) html += "<blockquote>" + inline(quoteMatch[1]) + "</blockquote>";
      else if (trimmed !== "") html += "<p>" + inline(trimmed) + "</p>";
    }
    if (inList) html += "</ul>";
    return html || inline(escapeHtml(texto));

    function inline(s) {
      s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      s = s.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, "$1<em>$2</em>$3");
      return s;
    }
  }

  function setBotText(wrap, texto, isError) {
    if (isError) wrap.classList.add("ai-chat-error");
    wrap.innerHTML = '<span class="ai-chat-avatar"><svg viewBox="0 0 24 24"><path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"/></svg></span><span class="ai-chat-content"></span>';
    var contentEl = wrap.querySelector(".ai-chat-content");
    if (isError) contentEl.textContent = texto;
    else contentEl.innerHTML = mdToHtml(texto);
    scrollToEnd();
  }

  function semAcento(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ");
  }

  function tokens(s) {
    return semAcento(s).split(/\s+/).filter(function (w) {
      return w.length > 2 && !STOP[w];
    });
  }

  function fatiar(texto) {
    var bruto = String(texto || "").replace(/\r\n/g, "\n");
    var blocos = bruto.split(/(?=^=== |\n(?=Art\.?\s*\d)|(?=^CAP[IÍ]TULO\s))/im);
    var saida = [];
    for (var i = 0; i < blocos.length; i++) {
      var t = blocos[i].trim().replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
      if (t.length < 40) continue;
      saida.push(t);
    }
    return saida;
  }

  function carregarDecreto() {
    if (decretoTexto) return Promise.resolve(decretoTexto);
    if (carregandoDecreto) return carregandoDecreto;
    carregandoDecreto = fetch(DECRETO_URL, { cache: "force-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (txt) {
        decretoTexto = txt;
        decretoPartes = fatiar(txt);
        return txt;
      })
      .catch(function (err) {
        carregandoDecreto = null;
        throw err;
      });
    return carregandoDecreto;
  }

  function tituloParte(parte) {
    var primeira = parte.split("\n").find(function (l) { return l.trim(); }) || "";
    return primeira.replace(/\s+/g, " ").slice(0, 140);
  }

  function consultarLocal(pergunta) {
    var termos = tokens(pergunta);
    if (!termos.length || !decretoPartes.length) return "";
    var ranked = decretoPartes.map(function (parte) {
      var bag = " " + semAcento(parte) + " ";
      var score = 0;
      for (var i = 0; i < termos.length; i++) {
        var w = termos[i];
        if (bag.indexOf(" " + w + " ") >= 0) score += 3;
        else if (bag.indexOf(w) >= 0) score += 1;
      }
      var art = pergunta.match(/\b(?:art(?:igo)?\.?\s*)(\d+)/i);
      if (art && new RegExp("art\\.?\\s*" + art[1] + "\\b", "i").test(parte)) score += 12;
      return { parte: parte, score: score };
    }).filter(function (x) { return x.score > 0; });
    ranked.sort(function (a, b) { return b.score - a.score; });
    var top = ranked.slice(0, 4).filter(function (x, i) {
      return i === 0 || x.score >= Math.max(3, ranked[0].score * 0.35);
    });
    if (!top.length) return "";
    var linhas = [
      "Encontrei estes trechos oficiais dos decretos relacionados à sua pergunta:",
      ""
    ];
    top.forEach(function (item) {
      var corpo = item.parte.replace(/\s+/g, " ").trim();
      if (corpo.length > 900) corpo = corpo.slice(0, 880) + "…";
      linhas.push("**" + tituloParte(item.parte) + "**");
      linhas.push("> " + corpo);
      linhas.push("");
    });
    linhas.push("Em caso de dúvida, confirme no texto completo do Decreto 1082/2008 e do Decreto 1666/2024.");
    return linhas.join("\n");
  }

  function lerJson(res) {
    return res.text().then(function (t) {
      t = String(t || "").trim();
      if (!t || t.charAt(0) === "<") return null;
      try { return JSON.parse(t); } catch (_) { return null; }
    });
  }

  function consultarAppsScript(pergunta) {
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("COLE_AQUI") === 0) {
      return Promise.resolve(null);
    }
    var urlGet = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.indexOf("?") >= 0 ? "&" : "?") + "pergunta=" + encodeURIComponent(pergunta);
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    return fetch(urlGet, { method: "GET", cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(lerJson)
      .then(function (data) {
        if (data && data.resposta) return String(data.resposta);
        return null;
      })
      .catch(function () { return null; })
      .finally(function () { clearTimeout(timer); });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var pergunta = input.value.trim();
    if (!pergunta) return;

    addUserMsg(pergunta);
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;
    var wrap = addBotTyping();

    Promise.all([
      consultarAppsScript(pergunta),
      carregarDecreto().catch(function () { return ""; })
    ])
      .then(function (pair) {
        var ia = pair[0];
        if (ia) {
          setBotText(wrap, ia, false);
          return;
        }
        var local = consultarLocal(pergunta);
        if (local) {
          setBotText(wrap, local, false);
          return;
        }
        setBotText(wrap, "Não encontrei trecho correspondente nos decretos 1082/2008 e 1666/2024. Tente perguntar com o número do artigo ou com palavras do regulamento (prazo, tarifa, usuário, fiscalização).", true);
      })
      .catch(function () {
        setBotText(wrap, "Não foi possível consultar o decreto agora. Recarregue a página e tente novamente.", true);
      })
      .finally(function () {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      });
  });

  carregarDecreto().catch(function () {});
})();
