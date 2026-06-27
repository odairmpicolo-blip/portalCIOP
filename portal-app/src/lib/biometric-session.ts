/** Controle de biometria na sessão do app nativo. */
let skipUnlockOnce = false
let unlockedUntil = 0

/** Período sem pedir Face ID de novo após desbloqueio bem-sucedido. */
const SESSION_MS = 5 * 60 * 1000

/** Só exige biometria de novo após ficar em background por este tempo. */
export const BACKGROUND_LOCK_MS = 45_000

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
