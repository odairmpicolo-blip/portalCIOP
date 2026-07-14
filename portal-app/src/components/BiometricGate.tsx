import { useEffect, useState, type ReactNode } from 'react'
import { preloadBiometricAuth } from '../lib/biometric-auth'
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
  const { unlocked, locking, tryUnlock, skipBiometric } = useBiometric()
  const { biometricEnabled } = useAppPreferences()
  const { labels } = useBiometryLabels()
  const native = useNativeApp()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (native) preloadBiometricAuth()
  }, [native])

  if (!native || !user || !biometricEnabled) return <>{children}</>

  if (loading) return <LoadingScreen label="Validando acesso" />

  if (!unlocked) {
    function handleUnlock() {
      setFailed(false)
      void tryUnlock().then((ok) => {
        if (!ok) setFailed(true)
      })
    }

    return (
      <div className="biometric-lock-page">
        <div className="biometric-lock-card app-glass">
          <div className="biometric-lock-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3.5H5.5a2 2 0 0 0-2 2V7" />
              <path d="M17 3.5h1.5a2 2 0 0 1 2 2V7" />
              <path d="M7 20.5H5.5a2 2 0 0 1-2-2V17" />
              <path d="M17 20.5h1.5a2 2 0 0 0 2-2V17" />
              <circle cx="9" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="15" cy="10.2" r="0.9" fill="currentColor" stroke="none" />
              <path d="M12 10v3.2c0 .5-.4.8-.9.8H10.6" />
              <path d="M8.5 16.2c.9.9 2.1 1.4 3.5 1.4s2.6-.5 3.5-1.4" />
            </svg>
          </div>
          <h1>Portal CIOP</h1>
          <p>{locking ? labels.verifyingLabel : labels.continueLabel}</p>
          {failed ? (
            <p className="biometric-lock-error" role="alert">
              Não foi possível confirmar. Tente de novo ou use uma opção abaixo.
            </p>
          ) : null}
          <div className="biometric-lock-actions">
            <button
              type="button"
              className="btn-primary biometric-lock-unlock"
              disabled={locking}
              onClick={handleUnlock}
            >
              {locking ? labels.verifyingLabel : labels.unlockButton}
            </button>
            <button type="button" className="btn-secondary biometric-lock-skip" onClick={skipBiometric}>
              Continuar sem biometria
            </button>
            <button type="button" className="btn-logout biometric-lock-logout" onClick={() => void logout()}>
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
