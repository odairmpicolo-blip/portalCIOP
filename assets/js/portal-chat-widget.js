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
} from "./portal-chat.js?v=20260719c";

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

function tocarSomLeve() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch (_) {}
}

function garantirCss() {
  if (document.querySelector("link[data-portal-chat-widget]")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = portalPath("assets/css/portal-chat-widget.css?v=20260719c");
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
    this.root = null;
  }

  podeUsar() {
    // Bolha para qualquer usuário logado (não depende do módulo side-chat do menu).
    if (paginaChatFull()) return false;
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
      <div class="pcw-toast" id="pcwToast" hidden role="status" aria-live="polite">
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
  }

  bind() {
    this.root.querySelector("#pcwFab").addEventListener("click", () => this.togglePainel());
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
    if (this.unsubSalas) this.unsubSalas();
    if (this.unsubPresenca) this.unsubPresenca();
    this.unsubSalas = ouvirMinhasSalas(this.meuEmail, (salas) => this.onSalas(salas));
    this.unsubPresenca = ouvirPresenca((lista) => {
      this.online = lista || [];
      if (this.painelAberto && this.view === "lista" && this.aba === "online") this.renderLista();
    });
  }

  onSalas(salas) {
    const anteriores = new Map(this.salas.map((s) => [s.id, timestampMs(s.ultimaMensagemEm || s.atualizadoEm)]));
    this.salas = salas || [];
    this.atualizarBadge();

    if (!this.vistoInicialSalas) {
      this.vistoInicialSalas = true;
      return;
    }

    for (const sala of this.salas) {
      const ts = timestampMs(sala.ultimaMensagemEm || sala.atualizadoEm);
      const antes = anteriores.get(sala.id) || 0;
      if (ts <= antes) continue;
      if (!salaTemNaoLida(sala, this.meuEmail)) continue;
      if (this.salaAtual === sala.id && this.painelAberto && this.view === "thread") {
        marcarSalaLida(sala.id, ts);
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
    const key = `${sala.id}:${timestampMs(sala.ultimaMensagemEm)}`;
    if (!email || key === this.ultimoToastKey) return;
    this.ultimoToastKey = key;

    if (this.painelAberto) {
      this.atualizarBadge();
      if (this.view === "lista") this.renderLista();
      tocarSomLeve();
      return;
    }

    const user = this.online.find((u) => normalizarEmailChat(u.email) === email);
    const nome = user?.nome || email;
    const toast = this.root.querySelector("#pcwToast");
    toast.dataset.email = email;
    this.root.querySelector("#pcwToastNome").textContent = nome;
    this.root.querySelector("#pcwToastTexto").textContent = sala.ultimaMensagem || "Nova mensagem";
    toast.hidden = false;
    tocarSomLeve();

    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.esconderToast(), 6500);
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
    if (online?.nome) return online.nome;
    const sala = this.salas.find((s) => outroMembroSala(s, this.meuEmail) === key);
    return sala?.nomes?.[key] || key;
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
          return `<button type="button" class="pcw-row" data-email="${escapeHtml(email)}">
            <span class="pcw-avatar">${escapeHtml(iniciais(u.nome, email))}<span class="pcw-dot"></span></span>
            <span class="pcw-meta">
              <strong>${escapeHtml(u.nome || email)}</strong>
              <span>${escapeHtml(u.perfil || "")}${u.cargo ? " · " + escapeHtml(u.cargo) : ""}</span>
            </span>
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
            <span class="pcw-meta">
              <strong>${escapeHtml(nome)}</strong>
              <span>${escapeHtml(sala.ultimaMensagem || "Sem mensagens")}</span>
            </span>
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
        return `<div class="pcw-bubble ${mine ? "mine" : "theirs"}">
          ${escapeHtml(m.texto)}
          <span class="pcw-time">${escapeHtml(formatarHoraMensagem(m.criadoEm))}</span>
        </div>`;
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
