(function () {
  function mensagemErroAlterarSenha(error) {
    const code = error && error.code ? error.code : "";
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      return "Senha atual incorreta.";
    }
    if (code === "auth/weak-password") {
      return "A nova senha é muito fraca. Use pelo menos 6 caracteres.";
    }
    if (code === "auth/requires-recent-login") {
      return "Por segurança, saia do portal, entre novamente e tente alterar a senha.";
    }
    if (code === "auth/too-many-requests") {
      return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    }
    if (code === "auth/network-request-failed") {
      return "Sem conexão com o servidor. Verifique a internet.";
    }
    const texto = error && error.message ? String(error.message) : "";
    return texto.replace(/^Firebase:\s*(Error\s*)?\([^)]+\)\.?\s*/i, "").trim()
      || "Não foi possível alterar a senha.";
  }

  window.portalMensagemErroSenha = mensagemErroAlterarSenha;

  window.toggleSenhaPanel = function (force) {
    const panel = document.getElementById("senhaPanel");
    if (!panel) return;
    const abrir = typeof force === "boolean" ? force : !panel.classList.contains("active");
    panel.classList.toggle("active", abrir);
    if (!abrir) {
      ["senhaAtual", "novaSenha", "confirmarSenha"].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      const status = document.getElementById("senhaStatus");
      if (status) {
        status.textContent = "";
        status.className = "password-status";
      }
    }
  };

  window.salvarNovaSenha = async function () {
    const status = document.getElementById("senhaStatus");
    const senhaAtual = document.getElementById("senhaAtual")?.value || "";
    const novaSenha = document.getElementById("novaSenha")?.value || "";
    const confirmarSenha = document.getElementById("confirmarSenha")?.value || "";

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      if (status) {
        status.className = "password-status erro";
        status.textContent = "Preencha a senha atual, a nova senha e a confirmação.";
      }
      return;
    }

    if (novaSenha !== confirmarSenha) {
      if (status) {
        status.className = "password-status erro";
        status.textContent = "A confirmação da senha não confere.";
      }
      return;
    }

    if (typeof window.alterarSenha !== "function") {
      if (status) {
        status.className = "password-status erro";
        status.textContent = "Autenticação ainda carregando. Aguarde e tente novamente.";
      }
      return;
    }

    if (status) {
      status.className = "password-status";
      status.textContent = "Alterando senha...";
    }

    try {
      await window.alterarSenha(senhaAtual, novaSenha);
      if (status) {
        status.className = "password-status ok";
        status.textContent = "Senha alterada com sucesso.";
      }
      ["senhaAtual", "novaSenha", "confirmarSenha"].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
    } catch (error) {
      if (status) {
        status.className = "password-status erro";
        status.textContent = "Não foi possível alterar: " + mensagemErroAlterarSenha(error);
      }
    }
  };

  function htmlPainelSenha() {
    return (
      '<h2>Alterar senha de acesso</h2>' +
      '<p class="password-panel-note">Qualquer usuário logado pode alterar a própria senha, independente do perfil.</p>' +
      '<label for="senhaAtual">Senha atual</label>' +
      '<input id="senhaAtual" type="password" autocomplete="current-password">' +
      '<label for="novaSenha">Nova senha</label>' +
      '<input id="novaSenha" type="password" autocomplete="new-password" minlength="6">' +
      '<label for="confirmarSenha">Confirmar nova senha</label>' +
      '<input id="confirmarSenha" type="password" autocomplete="new-password" minlength="6">' +
      '<div class="password-actions">' +
      '<button class="btn-small" type="button" id="btnSalvarSenhaPortal">Salvar senha</button>' +
      '<button class="btn-small secondary" type="button" id="btnCancelarSenhaPortal">Cancelar</button>' +
      '</div>' +
      '<div id="senhaStatus" class="password-status"></div>'
    );
  }

  function criarPainelSenha() {
    if (document.getElementById("senhaPanel")) return;
    const panel = document.createElement("section");
    panel.id = "senhaPanel";
    panel.className = "password-panel";
    panel.setAttribute("aria-label", "Alterar senha");
    panel.innerHTML = htmlPainelSenha();
    panel.querySelector("#btnSalvarSenhaPortal")?.addEventListener("click", window.salvarNovaSenha);
    panel.querySelector("#btnCancelarSenhaPortal")?.addEventListener("click", function () {
      window.toggleSenhaPanel(false);
    });
    const alvo = document.querySelector("main.container, .container, main") || document.body;
    alvo.insertBefore(panel, alvo.firstChild);
  }

  function criarBotaoSenha() {
    const session = document.querySelector(".ciop-session");
    if (!session) return;

    const existente = session.querySelector("[data-portal-senha-btn]");
    if (existente) return;

    const botaoSenha = Array.from(session.querySelectorAll("button")).find(function (btn) {
      return btn.textContent.trim().toLowerCase() === "senha";
    });
    if (botaoSenha) {
      botaoSenha.dataset.portalSenhaBtn = "1";
      return;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-senha-portal";
    btn.dataset.portalSenhaBtn = "1";
    btn.textContent = "Senha";
    btn.addEventListener("click", function () {
      window.toggleSenhaPanel();
    });

    const sair = session.querySelector("#btnLogout, button.btn-logout:not(.btn-senha-portal)");
    if (sair) session.insertBefore(btn, sair);
    else session.appendChild(btn);
  }

  window.initPortalSenhaUI = function () {
    criarBotaoSenha();
    criarPainelSenha();
  };

  function iniciar() {
    window.initPortalSenhaUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  window.addEventListener("portal:usuario-validado", iniciar);
})();
