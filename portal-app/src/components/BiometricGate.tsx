import { useState, type ReactNode } from 'react'
import { useAppPreferences } from '../context/app-preferences-context'
import { useBiometric } from '../context/biometric-context'
import { useAuth } from '../hooks/useAuth'
import { useBiometryLabels } from '../hooks/useBiometryLabels'
import { useNativeApp } from '../hooks/useNativeApp'
import { LoadingScreen } from './LoadingScreen'

type BiometricGateProps = {
  children: ReactNode
}

export function BiometricGate({ children }: BiometricGateProps) {
  const { user, loading, logout } = useAuth()
  const { unlocked, locking, tryUnlock } = useBiometric()
  const { biometricEnabled } = useAppPreferences()
  const { labels } = useBiometryLabels()
  const native = useNativeApp()
  const [failed, setFailed] = useState(false)

  if (!native || !user || !biometricEnabled) return <>{children}</>

  if (loading) return <LoadingScreen label="Validando acesso" />

  if (!unlocked) {
    async function handleUnlock() {
      setFailed(false)
      const ok = await tryUnlock()
      if (!ok) setFailed(true)
    }

    return (
      <div className="biometric-lock-page">
        <div className="biometric-lock-card app-glass">
          <div className="biometric-lock-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 11c1.66 0 3-1.34 3-3S13.66 5 12 5 9 6.34 9 8s1.34 3 3 3z" />
              <path d="M18 20v-1.5a4.5 4.5 0 0 0-9 0V20" />
              <rect x="3" y="11" width="18" height="10" rx="2.5" />
            </svg>
          </div>
          <h1>Portal CIOP</h1>
          <p>{locking ? labels.verifyingLabel : labels.continueLabel}</p>
          {failed ? (
            <p className="biometric-lock-error" role="alert">
              Não foi possível confirmar. Toque de novo ou saia e entre com senha.
            </p>
          ) : null}
          {!locking ? (
            <button type="button" className="btn-primary" onClick={() => void handleUnlock()}>
              {labels.unlockButton}
            </button>
          ) : (
            <div className="loading-spinner biometric-lock-spinner" aria-hidden="true" />
          )}
          <button type="button" className="btn-link biometric-lock-logout" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
