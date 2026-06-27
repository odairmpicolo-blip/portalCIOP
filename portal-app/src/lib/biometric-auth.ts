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

export async function getBiometryLabels(): Promise<BiometryLabels> {
  if (cachedLabels) return cachedLabels
  if (!isNativeBiometricContext()) {
    cachedLabels = GENERIC_LABELS
    return cachedLabels
  }
  try {
    const info = await BiometricAuth.checkBiometry()
    cachedLabels = labelsForType(info.biometryType)
  } catch {
    cachedLabels = GENERIC_LABELS
  }
  return cachedLabels
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNativeBiometricContext()) return false
  try {
    const info = await BiometricAuth.checkBiometry()
    return info.isAvailable
  } catch {
    return false
  }
}

export async function promptBiometric(reason?: string): Promise<boolean> {
  if (!isNativeBiometricContext()) return true
  try {
    const available = await isBiometricAvailable()
    if (!available) return false
    const labels = await getBiometryLabels()
    const auth = BiometricAuth.authenticate({
      reason: reason ?? labels.promptUnlock,
      cancelTitle: 'Cancelar',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Usar senha do iPhone',
      androidTitle: 'Portal CIOP',
      androidSubtitle: labels.continueLabel,
    })
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('biometric-timeout')), 90_000)
    })
    await Promise.race([auth, timeout])
    return true
  } catch (error) {
    if (error instanceof BiometryError && error.code === BiometryErrorType.userCancel) {
      return false
    }
    return false
  }
}
