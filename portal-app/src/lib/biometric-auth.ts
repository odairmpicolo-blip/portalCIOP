import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
  BiometryType,
} from '@aparajita/capacitor-biometric-auth'
import { Capacitor } from '@capacitor/core'
import { isNativeApp } from './portal-origin'

function isNativeBiometricContext(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true
  } catch {
    /* ignore */
  }
  return isNativeApp()
}

export type BiometryLabels = {
  name: string
  promptLogin: string
  promptUnlock: string
  promptDefault: string
  saveAccessLabel: string
  loginButton: string
  unlockButton: string
  verifyingLabel: string
  continueLabel: string
}

const GENERIC_LABELS: BiometryLabels = {
  name: 'Biometria',
  promptLogin: 'Confirme sua identidade para entrar no Portal CIOP',
  promptUnlock: 'Confirme sua identidade para continuar',
  promptDefault: 'Confirme sua identidade para acessar o Portal CIOP',
  saveAccessLabel: 'Salvar acesso e exigir biometria neste aparelho',
  loginButton: 'Entrar com biometria',
  unlockButton: 'Desbloquear com biometria',
  verifyingLabel: 'Verificando biometria',
  continueLabel: 'Use a biometria do aparelho para continuar',
}

function labelsForType(type: BiometryType): BiometryLabels {
  switch (type) {
    case BiometryType.faceId:
      return {
        name: 'Face ID',
        promptLogin: 'Use Face ID para entrar no Portal CIOP',
        promptUnlock: 'Use Face ID para continuar',
        promptDefault: 'Confirme sua identidade com Face ID',
        saveAccessLabel: 'Salvar acesso e exigir Face ID neste aparelho',
        loginButton: 'Entrar com Face ID',
        unlockButton: 'Desbloquear com Face ID',
        verifyingLabel: 'Verificando Face ID',
        continueLabel: 'Use Face ID para continuar',
      }
    case BiometryType.touchId:
      return {
        name: 'Touch ID',
        promptLogin: 'Use Touch ID para entrar no Portal CIOP',
        promptUnlock: 'Use Touch ID para continuar',
        promptDefault: 'Confirme sua identidade com Touch ID',
        saveAccessLabel: 'Salvar acesso e exigir Touch ID neste aparelho',
        loginButton: 'Entrar com Touch ID',
        unlockButton: 'Desbloquear com Touch ID',
        verifyingLabel: 'Verificando Touch ID',
        continueLabel: 'Use Touch ID para continuar',
      }
    case BiometryType.fingerprintAuthentication:
      return {
        name: 'Impressão digital',
        promptLogin: 'Use sua impressão digital para entrar no Portal CIOP',
        promptUnlock: 'Use sua impressão digital para continuar',
        promptDefault: 'Confirme sua identidade com impressão digital',
        saveAccessLabel: 'Salvar acesso e exigir impressão digital neste aparelho',
        loginButton: 'Entrar com impressão digital',
        unlockButton: 'Desbloquear com impressão digital',
        verifyingLabel: 'Verificando impressão digital',
        continueLabel: 'Use sua impressão digital para continuar',
      }
    case BiometryType.faceAuthentication:
      return {
        name: 'Reconhecimento facial',
        promptLogin: 'Use reconhecimento facial para entrar no Portal CIOP',
        promptUnlock: 'Use reconhecimento facial para continuar',
        promptDefault: 'Confirme sua identidade com reconhecimento facial',
        saveAccessLabel: 'Salvar acesso e exigir reconhecimento facial neste aparelho',
        loginButton: 'Entrar com reconhecimento facial',
        unlockButton: 'Desbloquear com reconhecimento facial',
        verifyingLabel: 'Verificando reconhecimento facial',
        continueLabel: 'Use reconhecimento facial para continuar',
      }
    default:
      return GENERIC_LABELS
  }
}

let cachedLabels: BiometryLabels | null = null
let cachedAvailable: boolean | null = null
let cachedUnlockReason = GENERIC_LABELS.promptUnlock

const AUTH_OPTIONS = {
  cancelTitle: 'Cancelar',
  allowDeviceCredential: true,
  iosFallbackTitle: 'Usar senha do iPhone',
  androidTitle: 'Portal CIOP',
  androidSubtitle: GENERIC_LABELS.continueLabel,
} as const

const AUTH_TIMEOUT_MS = 15_000

function raceAuth(auth: Promise<unknown>): Promise<boolean> {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('biometric-timeout')), AUTH_TIMEOUT_MS)
  })
  return Promise.race([auth, timeout])
    .then(() => true)
    .catch((error) => {
      if (error instanceof BiometryError && error.code === BiometryErrorType.userCancel) {
        return false
      }
      return false
    })
}

/** Pré-carrega labels/disponibilidade — nunca chamar no clique do usuário. */
export function preloadBiometricAuth(): void {
  if (!isNativeBiometricContext()) return
  void getBiometryLabels()
  void isBiometricAvailable()
}

export async function getBiometryLabels(): Promise<BiometryLabels> {
  if (cachedLabels) return cachedLabels
  if (!isNativeBiometricContext()) {
    cachedLabels = GENERIC_LABELS
    return cachedLabels
  }
  try {
    const info = await BiometricAuth.checkBiometry()
    cachedLabels = labelsForType(info.biometryType)
    cachedUnlockReason = cachedLabels.promptUnlock
  } catch {
    cachedLabels = GENERIC_LABELS
    cachedUnlockReason = GENERIC_LABELS.promptUnlock
  }
  return cachedLabels
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (cachedAvailable !== null) return cachedAvailable
  if (!isNativeBiometricContext()) {
    cachedAvailable = false
    return false
  }
  try {
    const info = await BiometricAuth.checkBiometry()
    cachedAvailable = info.isAvailable
  } catch {
    cachedAvailable = false
  }
  return cachedAvailable
}

/**
 * Chamada direta no gesto do usuário (sem await antes).
 * iOS rejeita Face ID se houver awaits antes de authenticate().
 */
export function promptBiometricFromGesture(reason?: string): Promise<boolean> {
  if (!isNativeBiometricContext()) return Promise.resolve(true)
  const auth = BiometricAuth.authenticate({
    reason: reason ?? cachedUnlockReason,
    ...AUTH_OPTIONS,
    androidSubtitle: cachedLabels?.continueLabel ?? GENERIC_LABELS.continueLabel,
  })
  return raceAuth(auth)
}

export async function promptBiometric(reason?: string): Promise<boolean> {
  if (!isNativeBiometricContext()) return true
  await getBiometryLabels()
  if (!(await isBiometricAvailable())) return false
  return promptBiometricFromGesture(reason ?? cachedUnlockReason)
}

export function getCachedUnlockReason(): string {
  return cachedUnlockReason
}
