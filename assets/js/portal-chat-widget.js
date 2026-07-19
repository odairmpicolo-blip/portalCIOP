/* Portal CIOP — bolha + popup + mini-chat (estilo WhatsApp) */
import {
  normalizarEmailChat,
  ouvirPresenca,
  ouvirMinhasSalas,
  garantirSalaDm,
  enviarMensagem,
  ouvirMensagens,
  formatarHoraMensagem,
  timestampMs,
  outroMembroSala,
  salaTemNaoLida,
  contarNaoLidas,
  marcarSalaLida
} from "./portal-chat.js?v=20260719j";

const ICON_CHAT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3C7.03 3 3 6.58 3 11c0 2.39 1.19 4.53 3.08 6.01L5 21l4.2-1.4c.9.27 1.84.4 2.8.4 4.97 0 9-3.58 9-8s-4.03-8-9-8zm0 14.5c-.78 0-1.54-.12-2.25-.35l-.5-.16-2.24.75.62-2.03-.17-.5C6.55 13.85 6 12.48 6 11c0-3.31 2.69-6 6-6s6 2.69 6 6-2.69 6-6 6z"/></svg>`;
const ICON_SEND = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;

function portalPath(file) {
  const inPages = window.location.pathname.includes("/pages/");
  return inPages ? "../" + file : file;
}

function paginaChatFull() {
  const path = String(window.location.pathname || "");
  return /\/chat\.html$/i.test(path) || /\/chat-historico\.html$/i.test(path);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iniciais(nome, email) {
  const base = String(nome || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

let audioCtx = null;
let audioPronto = false;

function desbloquearAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    audioPronto = true;
  } catch (_) {}
}

function tocarSomLeve() {
  desbloquearAudio();
  try {
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
  } catch (_) {}
  try {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1175, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (_) {}
}

const SOM_PREF_KEY = "portal_chat_som_ok_v1";

function somJaPermitido() {
  try {
    return localStorage.getItem(SOM_PREF_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function gravarSomPermitido() {
  try {
    localStorage.setItem(SOM_PREF_KEY, "1");
  } catch (_) {}
}

function pedirPermissaoNotificacao() {
  try {
    if (!("Notification" in window)) return Promise.resolve("unsupported");
    if (Notification.permission === "granted") return Promise.resolve("granted");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return Notification.requestPermission();
  } catch (_) {
    return Promise.resolve("error");
  }
}

function notificarSistema(titulo, corpo, forcar = false) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    // Mostra também com a aba em foco — o toast in-app já cobre, mas o SO reforça o alerta.
    if (!forcar && !document.hidden && document.hasFocus()) {
      // ainda assim notifica: usuário pediu alerta confiável
    }
    const n = new Notification(titulo || "Nova mensagem", {
      body: corpo || "",
      tag: "portal-chat-" + String(Date.now()),
      renotify: true,
      silent: false,
      requireInteraction: false
    });
    n.onclick = () => {
      try { window.focus(); } catch (_) {}
      n.close();
    };
    setTimeout(() => n.close(), 10000);
  } catch (_) {}
}

async function ativarSomEAlertas() {
  desbloquearAudio();
  gravarSomPermitido();
  const perm = await pedirPermissaoNotificacao();
  tocarSomLeve();
  if (perm === "granted") {
    notificarSistema("Chat Portal CIOP", "Alertas de mensagem ativados.", true);
  }
  return perm;
}

function garantirCss() {
  if (document.querySelector("link[data-portal-chat-widget]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-chat-widget.css?v=20260719j");
  link.dataset.portalChatWidget = "1";
  document.head.appendChild(link);
}

class PortalChatWidget {
  constructor() {
    this.meuEmail = "";
    this.painelAberto = false;
    this.aba = "conversas";
    this.view = "lista";
    this.salas = [];
    this.online = [];
    this.salaAtual = "";
    this.parceiro = null;
    this.unsubMsgs = null;
    this.unsubSalas = null;
    this.unsubPresenca = null;
    this.toastTimer = null;
    this.ultimoToastKey = "";
    this.vistoInicialSalas = false;
    this.fingerprints = new Map();
    this.envieiRecentemente = new Map();
    this.root = null;
  }

  podeUsar() {
    // Bolha em qualquer página autenticada, inclusive chat.html (para alertas).
    return Boolean(this.meuEmail);
  }

  montarDom() {
    garantirCss();
    if (document.getElementById("portalChatWidgetRoot")) {
      this.root = document.getElementById("portalChatWidgetRoot");
      return;
    }
    const root = document.createElement("div");
    root.id = "portalChatWidgetRoot";
    root.innerHTML = `
      <div class="pcw-perm" id="pcwPerm" hidden role="dialog" aria-labelledby="pcwPermTitle" aria-modal="true">
        <strong id="pcwPermTitle">Ativar sons do chat</strong>
        <p>O navegador precisa da sua permissão para tocar o alerta sonoro e mostrar notificações de novas mensagens.</p>
        <div class="pcw-perm-actions">
          <button type="button" class="pcw-perm-later" id="pcwPermLater">Agora não</button>
          <button type="button" class="pcw-perm-allow" id="pcwPermAllow">Permitir som</button>
        </div>
      </div>
      <div class="pcw-toast" id="pcwToast" hidden role="status" aria-live="assertive">
        <button type="button" class="pcw-toast-close" id="pcwToastClose" aria-label="Fechar">×</button>
        <strong id="pcwToastNome"></strong>
        <span id="pcwToastTexto"></span>
      </div>
      <div class="pcw-panel" id="pcwPanel" hidden>
        <div class="pcw-head">
          <button type="button" class="pcw-head-btn" id="pcwBack" hidden aria-label="Voltar">←</button>
          <h2 id="pcwTitle">Chat</h2>
          <a class="pcw-head-btn" id="pcwOpenFull" href="${portalPath("pages/chat.html")}" title="Abrir chat completo" aria-label="Abrir chat completo">↗</a>
          <button type="button" class="pcw-head-btn" id="pcwClose" aria-label="Fechar">×</button>
        </div>
        <div class="pcw-tabs" id="pcwTabs">
          <button type="button" class="pcw-tab is-active" data-tab="conversas">Conversas</button>
          <button type="button" class="pcw-tab" data-tab="online">Online</button>
        </div>
        <div class="pcw-body" id="pcwBody"></div>
      </div>
      <button type="button" class="pcw-fab" id="pcwFab" aria-label="Abrir chat">
        ${ICON_CHAT}
        <span class="pcw-badge" id="pcwBadge" hidden>0</span>
      </button>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.bind();
    this.agendarPedidoPermissao();
  }

  agendarPedidoPermissao() {
    if (somJaPermitido() && audioPronto) return;
    // Pequeno atraso para não competir com o carregamento da página.
    setTimeout(() => this.mostrarPedidoPermissao(), 1200);
  }

  mostrarPedidoPermissao() {
    const box = this.root?.querySelector("#pcwPerm");
    if (!box) return;
    if (somJaPermitido()) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
  }

  esconderPedidoPermissao() {
    const box = this.root?.querySelector("#pcwPerm");
    if (box) box.hidden = true;
  }

  bind() {
    this.root.querySelector("#pcwFab").addEventListener("click", async () => {
      if (!somJaPermitido()) {
        await ativarSomEAlertas();
        this.esconderPedidoPermissao();
      } else {
        desbloquearAudio();
      }
      this.togglePainel();
    });
    this.root.querySelector("#pcwPermAllow")?.addEventListener("click", async () => {
      const btn = this.root.querySelector("#pcwPermAllow");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Ativando...";
      }
      await ativarSomEAlertas();
      this.esconderPedidoPermissao();
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Permitir som";
      }
    });
    this.root.querySelector("#pcwPermLater")?.addEventListener("click", () => {
      this.esconderPedidoPermissao();
    });
    this.root.querySelector("#pcwClose").addEventListener("click", () => this.fecharPainel());
    this.root.querySelector("#pcwBack").addEventListener("click", () => this.mostrarLista());
    this.root.querySelector("#pcwToastClose").addEventListener("click", (ev) => {
      ev.stopPropagation();
      this.esconderToast();
    });
    this.root.querySelector("#pcwToast").addEventListener("click", () => {
      const email = this.root.querySelector("#pcwToast").dataset.email;
      if (email) this.abrirConversa(email);
      this.esconderToast();
    });
    this.root.querySelectorAll(".pcw-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.aba = btn.dataset.tab;
        this.root.querySelectorAll(".pcw-tab").forEach((b) => b.classList.toggle("is-active", b === btn));
        this.renderLista();
      });
    });
  }

  iniciar(user = window.portalUsuario) {
    this.meuEmail = normalizarEmailChat(user?.email);
    if (!this.podeUsar()) return;
    this.montarDom();
    // Na página cheia do chat, esconde só a bolha — mantém listener de alertas.
    if (paginaChatFull() && this.root) {
      this.root.classList.add("pcw-embedded-page");
    }
    if (this.unsubSalas) this.unsubSalas();
    if (this.unsubPresenca) this.unsubPresenca();
    this.vistoInicialSalas = false;
    this.fingerprints = new Map();
    this.unsubSalas = ouvirMinhasSalas(this.meuEmail, (salas) => this.onSalas(salas));
    this.unsubPresenca = ouvirPresenca((lista) => {
      this.online = lista || [];
      const emails = (lista || []).map((u) => u.email).filter(Boolean);
      try {
        if (typeof ouvirMinhasSalas.redescobrir === "function") {
          ouvirMinhasSalas.redescobrir(emails);
        }
      } catch (_) {}
      if (this.painelAberto && this.view === "lista" && this.aba === "online") this.renderLista();
      if (this.painelAberto && this.view === "lista" && this.aba === "conversas") this.renderLista();
    });
  }

  fingerprintSala(sala) {
    return [
      timestampMs(sala?.ultimaMensagemEm || sala?.atualizadoEm),
      String(sala?.ultimaMensagem || ""),
      normalizarEmailChat(sala?.ultimaMensagemDe)
    ].join("|");
  }

  marqueiEnvioLocal(salaId) {
    if (!salaId) return;
    this.envieiRecentemente.set(salaId, Date.now());
  }

  foiEnvioMeu(sala) {
    const de = normalizarEmailChat(sala?.ultimaMensagemDe);
    if (de && de === this.meuEmail) return true;
    const t = this.envieiRecentemente.get(sala?.id) || 0;
    return Boolean(t && Date.now() - t < 4000);
  }

  onSalas(salas) {
    const lista = salas || [];
    this.salas = lista;
    this.atualizarBadge();

    if (!this.vistoInicialSalas) {
      this.vistoInicialSalas = true;
      lista.forEach((sala) => this.fingerprints.set(sala.id, this.fingerprintSala(sala)));
      return;
    }

    for (const sala of lista) {
      const fp = this.fingerprintSala(sala);
      const anterior = this.fingerprints.get(sala.id);
      this.fingerprints.set(sala.id, fp);
      if (!sala.ultimaMensagem) continue;
      if (anterior === fp) continue;
      if (this.foiEnvioMeu(sala)) continue;

      if (this.salaAtual === sala.id && this.painelAberto && this.view === "thread") {
        marcarSalaLida(sala.id, timestampMs(sala.ultimaMensagemEm) || Date.now());
        this.atualizarBadge();
        continue;
      }

      this.mostrarToastNovaMensagem(sala);
      break;
    }

    if (this.painelAberto && this.view === "lista") this.renderLista();
  }

  atualizarBadge() {
    const n = contarNaoLidas(this.salas, this.meuEmail);
    const badge = this.root?.querySelector("#pcwBadge");
    if (!badge) return;
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = n > 99 ? "99+" : String(n);
    } else {
      badge.hidden = true;
    }
  }

  mostrarToastNovaMensagem(sala) {
    const email = outroMembroSala(sala, this.meuEmail);
    const key = this.fingerprintSala(sala);
    if (!email || key === this.ultimoToastKey) return;
    this.ultimoToastKey = key;

    const user = this.online.find((u) => normalizarEmailChat(u.email) === email);
    const nome = (user?.nome && String(user.nome).trim()) || this.nomeDeEmail(email);
    const texto = sala.ultimaMensagem || "Nova mensagem";

    if (!(this.painelAberto && this.view === "thread" && this.salaAtual === sala.id)) {
      const toast = this.root.querySelector("#pcwToast");
      if (toast) {
        toast.dataset.email = email;
        this.root.querySelector("#pcwToastNome").textContent = nome;
        this.root.querySelector("#pcwToastTexto").textContent = texto;
        toast.hidden = false;
        toast.classList.remove("pcw-toast-pulse");
        void toast.offsetWidth;
        toast.classList.add("pcw-toast-pulse");
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.esconderToast(), 8000);
      }
    }

    if (this.painelAberto && this.view === "lista") this.renderLista();
    this.atualizarBadge();
    tocarSomLeve();
    notificarSistema(nome, texto, true);
  }

  esconderToast() {
    const toast = this.root?.querySelector("#pcwToast");
    if (toast) toast.hidden = true;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  togglePainel() {
    if (this.painelAberto) this.fecharPainel();
    else this.abrirPainel();
  }

  abrirPainel() {
    this.painelAberto = true;
    this.esconderToast();
    this.root.querySelector("#pcwPanel").hidden = false;
    if (this.view === "thread" && this.parceiro) this.renderThreadShell();
    else this.mostrarLista();
  }

  fecharPainel() {
    this.painelAberto = false;
    this.root.querySelector("#pcwPanel").hidden = true;
  }

  mostrarLista() {
    this.view = "lista";
    if (typeof this.unsubMsgs === "function") {
      this.unsubMsgs();
      this.unsubMsgs = null;
    }
    this.salaAtual = "";
    this.parceiro = null;
    this.root.querySelector("#pcwBack").hidden = true;
    this.root.querySelector("#pcwTabs").hidden = false;
    this.root.querySelector("#pcwTitle").textContent = "Chat";
    this.renderLista();
  }

  nomeDeEmail(email) {
    const key = normalizarEmailChat(email);
    const online = this.online.find((u) => normalizarEmailChat(u.email) === key);
    if (online?.nome) return String(online.nome).trim();
    const sala = this.salas.find((s) => outroMembroSala(s, this.meuEmail) === key);
    const nomeSala = sala?.nomes?.[key];
    if (nomeSala) return String(nomeSala).trim();
    // Sem cadastro de nome: usa a parte antes do @, nunca o e-mail completo na UI.
    const local = key.split("@")[0] || key;
    return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  renderLista() {
    const body = this.root.querySelector("#pcwBody");
    if (this.aba === "online") {
      const outros = this.online.filter((u) => normalizarEmailChat(u.email) !== this.meuEmail);
      if (!outros.length) {
        body.innerHTML = '<div class="pcw-empty">Nenhum outro usuário online agora.</div>';
        return;
      }
      body.innerHTML = outros
        .map((u) => {
          const email = normalizarEmailChat(u.email);
          const nome = String(u.nome || this.nomeDeEmail(email)).trim();
          return `<button type="button" class="pcw-row" data-email="${escapeHtml(email)}">
            <span class="pcw-avatar">${escapeHtml(iniciais(nome, email))}<span class="pcw-dot"></span></span>
            <span class="pcw-meta"><strong>${escapeHtml(nome)}</strong></span>
          </button>`;
        })
        .join("");
    } else {
      if (!this.salas.length) {
        body.innerHTML = '<div class="pcw-empty">Nenhuma conversa ainda.<br>Abra a aba Online e inicie um chat.</div>';
        return;
      }
      body.innerHTML = this.salas
        .map((sala) => {
          const email = outroMembroSala(sala, this.meuEmail);
          const nome = this.nomeDeEmail(email);
          const unread = salaTemNaoLida(sala, this.meuEmail);
          return `<button type="button" class="pcw-row" data-email="${escapeHtml(email)}">
            <span class="pcw-avatar">${escapeHtml(iniciais(nome, email))}</span>
            <span class="pcw-meta"><strong>${escapeHtml(nome)}</strong></span>
            ${unread ? '<span class="pcw-row-badge">1</span>' : ""}
          </button>`;
        })
        .join("");
    }
    body.querySelectorAll(".pcw-row").forEach((btn) => {
      btn.addEventListener("click", () => this.abrirConversa(btn.dataset.email));
    });
  }

  async abrirConversa(email) {
    const alvo = normalizarEmailChat(email);
    if (!alvo || alvo === this.meuEmail) return;
    this.painelAberto = true;
    this.root.querySelector("#pcwPanel").hidden = false;
    this.view = "thread";
    this.parceiro = { email: alvo, nome: this.nomeDeEmail(alvo) };
    this.root.querySelector("#pcwBack").hidden = false;
    this.root.querySelector("#pcwTabs").hidden = true;
    this.root.querySelector("#pcwTitle").textContent = this.parceiro.nome;
    this.renderThreadShell();

    try {
      const sala = await garantirSalaDm(this.meuEmail, alvo);
      this.salaAtual = sala.id;
      marcarSalaLida(sala.id, Date.now());
      this.atualizarBadge();
      if (typeof this.unsubMsgs === "function") this.unsubMsgs();
      this.unsubMsgs = ouvirMensagens(this.salaAtual, (msgs) => {
        this.renderMensagens(msgs);
        marcarSalaLida(this.salaAtual, Date.now());
        this.atualizarBadge();
      });
    } catch (err) {
      const body = this.root.querySelector("#pcwBody");
      body.innerHTML = `<div class="pcw-empty">${escapeHtml(err.message || "Não foi possível abrir a conversa.")}</div>`;
    }
  }

  renderThreadShell() {
    const body = this.root.querySelector("#pcwBody");
    body.innerHTML = `
      <div class="pcw-thread">
        <div class="pcw-msgs" id="pcwMsgs"><div class="pcw-empty">Carregando...</div></div>
        <form class="pcw-composer" id="pcwComposer">
          <input id="pcwInput" type="text" maxlength="4000" placeholder="Mensagem" autocomplete="off">
          <button type="submit" aria-label="Enviar">${ICON_SEND}</button>
        </form>
      </div>`;
    body.querySelector("#pcwComposer").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const input = body.querySelector("#pcwInput");
      const texto = input.value;
      if (!this.salaAtual) return;
      try {
        this.marqueiEnvioLocal(this.salaAtual);
        await enviarMensagem(this.salaAtual, texto, this.meuEmail);
        input.value = "";
        input.focus();
      } catch (err) {
        alert(err.message || "Falha ao enviar.");
      }
    });
    setTimeout(() => body.querySelector("#pcwInput")?.focus(), 50);
  }

  renderMensagens(msgs) {
    const el = this.root.querySelector("#pcwMsgs");
    if (!el) return;
    if (!msgs.length) {
      el.innerHTML = '<div class="pcw-empty">Nenhuma mensagem ainda.</div>';
      return;
    }
    el.innerHTML = msgs
      .map((m) => {
        const mine = normalizarEmailChat(m.de) === this.meuEmail;
        return `<div class="pcw-bubble ${mine ? "mine" : "theirs"}"><span class="pcw-bubble-text">${escapeHtml(m.texto)}</span><span class="pcw-time">${escapeHtml(formatarHoraMensagem(m.criadoEm))}</span></div>`;
      })
      .join("");
    el.scrollTop = el.scrollHeight;
  }
}

const widget = new PortalChatWidget();

export function iniciarPortalChatWidget(user = window.portalUsuario) {
  widget.iniciar(user);
}

if (typeof window.portalAguardarUsuario === "function") {
  window.portalAguardarUsuario((user) => iniciarPortalChatWidget(user));
} else if (window.portalUsuarioValidado) {
  iniciarPortalChatWidget(window.portalUsuario);
} else {
  window.addEventListener("portal:usuario-validado", (ev) => {
    iniciarPortalChatWidget(ev.detail || window.portalUsuario);
  }, { once: true });
}
