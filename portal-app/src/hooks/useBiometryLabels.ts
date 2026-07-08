import { useEffect, useState } from 'react'
import { getBiometryLabels, isBiometricAvailable, type BiometryLabels } from '../lib/biometric-auth'
import { isNativeApp } from '../lib/portal-origin'

const FALLBACK: BiometryLabels = {
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

export function useBiometryLabels() {
  const native = isNativeApp()
  const [labels, setLabels] = useState<BiometryLabels>(FALLBACK)
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(native)

  useEffect(() => {
    if (!native) {
      return
    }
    let cancelled = false
    void (async () => {
      const avail = await isBiometricAvailable()
      if (cancelled) return
      setAvailable(avail)
      if (avail) {
        const next = await getBiometryLabels()
        if (!cancelled) setLabels(next)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [native])

  return { labels, available, loading, native }
}
