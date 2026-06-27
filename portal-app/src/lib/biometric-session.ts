/** Evita segunda biometria logo após login manual ou com biometria na tela de login. */
let skipUnlockOnce = false

export function markBiometricSatisfied(): void {
  skipUnlockOnce = true
}

export function consumeBiometricSkip(): boolean {
  const skip = skipUnlockOnce
  skipUnlockOnce = false
  return skip
}
