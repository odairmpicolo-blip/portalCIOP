import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { app as primaryApp, normalizarEmail, excluirUsuarioFirestore } from "./portal-firestore.js";

const CONSOLE_AUTH_USUARIOS = "https://console.firebase.google.com/project/portal-ciop/authentication/users";

const SECONDARY_APP_NAME = "PortalAuthProvision";

function senhaTemporariaSegura() {
  const base = crypto.randomUUID().replace(/-/g, "");
  return `Prt${base.slice(0, 18)}!9`;
}

function obterAppSecundario() {
  const existente = getApps().find((item) => item.name === SECONDARY_APP_NAME);
  if (existente) return existente;
  return initializeApp(firebaseConfig, SECONDARY_APP_NAME);
}

function mensagemErroAuth(error) {
  const code = String(error?.code || "");
  if (code === "auth/invalid-email") return "E-mail inválido para o Firebase Authentication.";
  if (code === "auth/weak-password") return "Não foi possível gerar senha temporária válida.";
  if (code === "auth/operation-not-allowed") {
    return "Login por e-mail/senha não está habilitado no Firebase Authentication.";
  }
  if (code === "auth/too-many-requests") {
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  }
  return error?.message || "Erro ao criar login no Firebase.";
}

/**
 * Cria o usuário no Firebase Authentication sem encerrar a sessão do admin.
 * Se o e-mail já existir, apenas confirma e segue.
 */
export async function garantirUsuarioFirebaseAuth(email, { enviarLinkSenha = true } = {}) {
  const emailNorm = normalizarEmail(email);
  if (!emailNorm) throw new Error("E-mail inválido.");

  const secondaryApp = obterAppSecundario();
  const secondaryAuth = getAuth(secondaryApp);
  let criado = false;

  try {
    await createUserWithEmailAndPassword(secondaryAuth, emailNorm, senhaTemporariaSegura());
    criado = true;
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") {
      criado = false;
    } else {
      throw new Error(mensagemErroAuth(error));
    }
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }

  let linkSenhaEnviado = false;
  if (criado && enviarLinkSenha) {
    const primaryAuth = getAuth(primaryApp);
    await sendPasswordResetEmail(primaryAuth, emailNorm);
    linkSenhaEnviado = true;
  }

  return { criado, linkSenhaEnviado, email: emailNorm };
}

export async function enviarLinkDefinicaoSenha(email) {
  const emailNorm = normalizarEmail(email);
  if (!emailNorm) throw new Error("E-mail inválido.");
  const primaryAuth = getAuth(primaryApp);
  await sendPasswordResetEmail(primaryAuth, emailNorm);
  return emailNorm;
}

/** Remove o perfil do portal (Firestore). Login Firebase: remover manualmente no Console. */
export async function excluirUsuarioPortalCompleto(email) {
  const emailNorm = normalizarEmail(email);
  if (!emailNorm) throw new Error("E-mail inválido.");

  await excluirUsuarioFirestore(emailNorm);

  return {
    email: emailNorm,
    firestoreRemovido: true,
    consoleAuthUrl: CONSOLE_AUTH_USUARIOS
  };
}
