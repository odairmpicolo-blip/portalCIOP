import {
  getAuth,
  multiFactor,
  TotpMultiFactorGenerator
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { app } from "./portal-firestore.js";

function mensagemMfa(error) {
  const code = error?.code || "";
  if (code === "auth/operation-not-allowed" || /identity platform|second factor/i.test(String(error?.message || ""))) {
    return "O 2FA (TOTP) ainda não está ligado no projeto Firebase. No console: Authentication → MFA → TOTP.";
  }
  return error?.message || String(error);
}

export async function statusMfaAdmin() {
  const user = getAuth(app).currentUser;
  if (!user) return { enrolled: false };
  const enrolled = (user.multiFactor?.enrolledFactors || []).some((f) => f.factorId === "totp" || f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
  return { enrolled };
}

export async function iniciarInscricaoTotp() {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error("Sessão expirada.");
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  return {
    secret,
    chave: secret.secretKey,
    uri: typeof secret.generateQrCodeUrl === "function"
      ? secret.generateQrCodeUrl(user.email || "Portal CIOP", "Portal CIOP")
      : ""
  };
}

export async function confirmarInscricaoTotp(secret, codigo) {
  const user = getAuth(app).currentUser;
  if (!user) throw new Error("Sessão expirada.");
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, String(codigo || "").trim());
  await multiFactor(user).enroll(assertion, "Authenticator");
}

export { mensagemMfa };

function montarPainel(host) {
  if (host.querySelector("#mfaAdminBox")) return;
  const box = document.createElement("div");
  box.id = "mfaAdminBox";
  box.style.marginTop = "22px";
  box.innerHTML = `
    <h2 style="font-size:16px;margin:0 0 8px">2FA do administrador</h2>
    <p class="password-panel-note">App autenticador (Google Authenticator, 1Password, etc.). Só Administrador.</p>
    <p id="mfaAdminStatus" class="password-panel-note"></p>
    <p id="mfaAdminChave" hidden style="font-family:ui-monospace,monospace;word-break:break-all;font-size:13px"></p>
    <label for="mfaAdminCodigo" hidden id="mfaAdminLabel">Código de 6 dígitos</label>
    <input id="mfaAdminCodigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" hidden>
    <div class="password-actions">
      <button class="btn-small" type="button" id="mfaAdminBtn">Ativar 2FA</button>
    </div>
    <div id="mfaAdminErro" class="password-status"></div>
  `;
  host.appendChild(box);

  let secretPendente = null;
  const status = box.querySelector("#mfaAdminStatus");
  const chaveEl = box.querySelector("#mfaAdminChave");
  const codigo = box.querySelector("#mfaAdminCodigo");
  const label = box.querySelector("#mfaAdminLabel");
  const btn = box.querySelector("#mfaAdminBtn");
  const erro = box.querySelector("#mfaAdminErro");

  async function refrescar() {
    try {
      const s = await statusMfaAdmin();
      status.textContent = s.enrolled
        ? "2FA já está ativo nesta conta."
        : "Ainda não há 2FA nesta conta.";
      btn.hidden = s.enrolled;
    } catch (e) {
      status.textContent = mensagemMfa(e);
    }
  }

  btn.addEventListener("click", async () => {
    erro.textContent = "";
    try {
      if (!secretPendente) {
        const ini = await iniciarInscricaoTotp();
        secretPendente = ini.secret;
        chaveEl.hidden = false;
        chaveEl.textContent = `Chave: ${ini.chave}`;
        label.hidden = false;
        codigo.hidden = false;
        btn.textContent = "Confirmar código";
        return;
      }
      await confirmarInscricaoTotp(secretPendente, codigo.value);
      secretPendente = null;
      chaveEl.hidden = true;
      codigo.hidden = true;
      label.hidden = true;
      btn.hidden = true;
      status.textContent = "2FA ativado.";
    } catch (e) {
      erro.textContent = mensagemMfa(e);
    }
  });

  refrescar();
}

window.addEventListener("portal:usuario-validado", () => {
  if (!window.portalUsuario?.isAdmin) return;
  const host = document.getElementById("senhaPanel");
  if (host) montarPainel(host);
});
