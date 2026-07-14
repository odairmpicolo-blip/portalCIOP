/** Controle de biometria na sessão do app nativo. */
let skipUnlockOnce = false
let unlockedUntil = 0

/** Período sem pedir Face ID de novo após desbloqueio bem-sucedido.
 *  Antes eram 5 minutos — curto demais para uma sessão normal de uso
 *  (navegar entre várias páginas, preencher formulários, etc. já passa
 *  disso), fazendo o Face ID ser pedido de novo no meio do uso mesmo
 *  sem o app ter saído de primeiro plano. */
const SESSION_MS = 30 * 60 * 1000

/** Só exige biometria de novo após ficar em background por este tempo.
 *  Antes eram 45s — qualquer troca rápida de app (ver uma notificação,
 *  copiar algo, tirar print) já forçava novo Face ID ao voltar. */
export const BACKGROUND_LOCK_MS = 3 * 60 * 1000

export function markBiometricSatisfied(): void {
  skipUnlockOnce = true
  markBiometricUnlocked()
}

export function markBiometricUnlocked(): void {
  unlockedUntil = Date.now() + SESSION_MS
}

export function isBiometricSessionValid(): boolean {
  return Date.now() < unlockedUntil
}

export function consumeBiometricSkip(): boolean {
  const skip = skipUnlockOnce
  skipUnlockOnce = false
  return skip
}
