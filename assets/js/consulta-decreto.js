(function () {
  var DECRETO_URL = "../assets/data/decreto_context.txt?v=20260824d2";
  var API_FALLBACK = "https://62wvo4yk9b.execute-api.sa-east-1.amazonaws.com";
  var STOP = {
    a: 1, ao: 1, aos: 1, as: 1, ate: 1, com: 1, como: 1, da: 1, das: 1, de: 1, do: 1, dos: 1,
    e: 1, em: 1, entre: 1, essa: 1, esse: 1, este: 1, esta: 1, eu: 1, ha: 1, isso: 1, la: 1,
    me: 1, na: 1, nas: 1, no: 1, nos: 1, o: 1, os: 1, ou: 1, para: 1, pela: 1, pelo: 1, por: 1,
    qual: 1, quais: 1, que: 1, se: 1, sao: 1, ser: 1, seu: 1, sua: 1, um: 1, uma: 1, uns: 1,
    art: 1, artigo: 1, artigos: 1, decreto: 1, decretos: 1, sobre: 1, alguma: 1, algo: 1,
    previsto: 1, previstos: 1, prevista: 1, diz: 1, fala: 1, pode: 1, posso: 1
  };
  var SINONIMOS = {
    prazo: ["prazos"],
    prazos: ["prazo"],
    tarifa: ["tarifas", "pagamento", "preco"],
    gratuidade: ["isencao", "isento", "passe"],
    isencao: ["gratuidade", "isento"],
    usuario: ["usuarios", "passageiro", "passageiros"],
    usuarios: ["usuario", "passageiro"],
    fiscalizacao: ["fiscalizar", "vistoria", "vistoriar"],
    ponto: ["parada", "embarque", "desembarque"],
    concessao: ["concessionaria", "concessionarias", "outorga"],
    cmtu: ["orgao", "gestor"],
    acessibilidade: ["cadeirante", "deficiente", "pcd"],
    idoso: ["idosos", "terceira"]
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

  function variantes(w) {
    var out = [w];
    var extra = SINONIMOS[w];
    if (extra) out = out.concat(extra);
    if (w.length > 4 && w.charAt(w.length - 1) === "s") out.push(w.slice(0, -1));
    if (w.length > 5 && w.slice(-3) === "oes") out.push(w.slice(0, -3) + "ao");
    return out;
  }

  function tokens(s) {
    var base = semAcento(s).split(/\s+/).filter(function (w) {
      return (w.length > 2 && !STOP[w]) || /^\d+$/.test(w);
    });
    var set = {};
    base.forEach(function (w) {
      variantes(w).forEach(function (v) { if (v) set[v] = 1; });
    });
    return Object.keys(set);
  }

  function limparTexto(texto) {
    return String(texto || "")
      .replace(/\r\n/g, "\n")
      .replace(/-\n[ \t]*/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  function fatiar(texto) {
    var bruto = limparTexto(texto);
    var blocos = bruto.split(/(?=(?:^|\n)(?:=== |Art\.?\s*\d|CAP[IÍ]TULO\s))/im);
    var saida = [];
    for (var i = 0; i < blocos.length; i++) {
      var t = blocos[i].trim();
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
    return primeira.replace(/\s+/g, " ").slice(0, 160);
  }

  function artigosNaPergunta(pergunta) {
    var nums = [];
    var re = /\b(?:art(?:igo)?\.?\s*)(\d+)/gi;
    var m;
    while ((m = re.exec(pergunta))) nums.push(m[1]);
    return nums;
  }

  function ranquear(pergunta) {
    var termos = tokens(pergunta);
    var arts = artigosNaPergunta(pergunta);
    if ((!termos.length && !arts.length) || !decretoPartes.length) return [];
    return decretoPartes.map(function (parte) {
      var bag = " " + semAcento(parte) + " ";
      var score = 0;
      for (var i = 0; i < termos.length; i++) {
        var w = termos[i];
        if (bag.indexOf(" " + w + " ") >= 0) score += 3;
        else if (w.length >= 5 && bag.indexOf(w) >= 0) score += 1;
      }
      for (var j = 0; j < arts.length; j++) {
        if (new RegExp("art\\.?\\s*" + arts[j] + "\\b", "i").test(parte)) score += 16;
      }
      return { parte: parte, score: score };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function trechosParaIa(ranked) {
    return ranked.slice(0, 8).map(function (item, i) {
      var corpo = item.parte.replace(/\s+/g, " ").trim();
      if (corpo.length > 1800) corpo = corpo.slice(0, 1780) + "…";
      return "(" + (i + 1) + ") " + corpo;
    }).join("\n\n");
  }

  function responderLocal(pergunta, ranked) {
    var top = ranked.slice(0, 5).filter(function (x, i) {
      return i === 0 || x.score >= Math.max(3, ranked[0].score * 0.28);
    });
    if (!top.length) return "";
    var linhas = [
      "Com base no texto oficial dos Decretos **1082/2008** e **1666/2024**, isto responde à sua pergunta:",
      ""
    ];
    top.forEach(function (item) {
      var corpo = item.parte.replace(/\s+/g, " ").trim();
      if (corpo.length > 1100) corpo = corpo.slice(0, 1080) + "…";
      linhas.push("**" + tituloParte(item.parte) + "**");
      linhas.push("> " + corpo);
      linhas.push("");
    });
    linhas.push("Em caso de dúvida, confirme no texto completo do decreto.");
    return linhas.join("\n");
  }

  function lerJson(res) {
    return res.text().then(function (t) {
      t = String(t || "").trim();
      if (!t || t.charAt(0) === "<") return null;
      try { return JSON.parse(t); } catch (_) { return null; }
    });
  }

  function obterApiUrl() {
    return fetch("../assets/data/portal-runtime.json", { cache: "no-store" })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (cfg) {
        var url = String((cfg && cfg.awsApiUrl) || API_FALLBACK).replace(/\/+$/, "");
        return url || API_FALLBACK;
      })
      .catch(function () { return API_FALLBACK; });
  }

  function consultarGemini(pergunta, trechos) {
    var prompt = [
      "Você é o assistente do Portal CIOP (TCGL, transporte coletivo urbano de Londrina/PR).",
      "Responda em português do Brasil, de forma direta, como um assistente.",
      "",
      "Estruture SEMPRE a resposta em duas partes, nesta ordem:",
      "",
      "**No decreto (texto oficial)**",
      "Use os trechos oficiais abaixo (Decreto municipal 1082/2008 e Decreto 1666/2024).",
      "Cite o artigo (Art. N) quando o trecho tiver. Não invente artigos, prazos, valores nem obrigações desses decretos.",
      "Se os trechos não cobrirem a pergunta, diga isso em uma frase.",
      "",
      "**Além do decreto (busca atual)**",
      "Use a busca do Google (ferramenta google_search) para informação vigente em Londrina/PR: valor da tarifa, gratuidade, CMTU, leis municipais, notícias oficiais.",
      "Para preço de passagem, procure a tarifa atual da CMTU/Prefeitura de Londrina e cite a fonte e a data se aparecer.",
      "Deixe claro que este bloco NÃO é transcrição do decreto. Não invente Art. N do 1082/2008 ou 1666/2024.",
      "Se a busca não trouxer o valor, diga que não encontrou tabela vigente — não chute um R$.",
      "",
      "Pergunta do operador:",
      pergunta,
      "",
      trechos
        ? ("Trechos oficiais encontrados:\n" + trechos)
        : "Não há trecho do decreto indexado para esta pergunta. Responda mesmo assim: no primeiro bloco diga que não há trecho local; no segundo, complemente com o que souber, com a ressalva."
    ].join("\n");

    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 28000);
    return obterApiUrl()
      .then(function (api) {
        return fetch(api + "/relatorio-ia", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt, buscaWeb: true }),
          signal: ctrl ? ctrl.signal : undefined
        });
      })
      .then(lerJson)
      .then(function (data) {
        if (!(data && data.ok && data.texto)) return null;
        var texto = String(data.texto).trim();
        var fontes = Array.isArray(data.fontes) ? data.fontes.filter(Boolean) : [];
        if (fontes.length) {
          texto += "\n\n**Fontes da busca**\n" + fontes.map(function (u) { return "- " + u; }).join("\n");
        }
        return texto;
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

    carregarDecreto()
      .then(function () {
        var ranked = ranquear(pergunta);
        var local = responderLocal(pergunta, ranked);
        return consultarGemini(pergunta, trechosParaIa(ranked)).then(function (ia) {
          return { ia: ia, local: local };
        });
      })
      .then(function (r) {
        if (r.ia) {
          setBotText(wrap, r.ia, false);
          return;
        }
        if (r.local) {
          setBotText(wrap, r.local, false);
          return;
        }
        setBotText(wrap, "Não encontrei trecho correspondente nos decretos 1082/2008 e 1666/2024. Tente o número do artigo ou palavras do regulamento (prazo, tarifa, usuário, fiscalização, gratuidade).", true);
      })
      .catch(function () {
        setBotText(wrap, "Não foi possível carregar o texto do decreto. Recarregue a página e tente novamente.", true);
      })
      .finally(function () {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
      });
  });

  carregarDecreto().catch(function () {});
})();
