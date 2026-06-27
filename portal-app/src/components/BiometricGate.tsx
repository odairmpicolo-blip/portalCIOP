import type { ReactNode } from 'react'
import { useBiometric } from '../context/biometric-context'
import { useAuth } from '../hooks/useAuth'
import { useBiometryLabels } from '../hooks/useBiometryLabels'
import { useNativeApp } from '../hooks/useNativeApp'
import { LoadingScreen } from './LoadingScreen'

type BiometricGateProps = {
  children: ReactNode
}

export function BiometricGate({ children }: BiometricGateProps) {
  const { user, loading } = useAuth()
  const { unlocked, locking, tryUnlock } = useBiometric()
  const { labels } = useBiometryLabels()
  const native = useNativeApp()

  if (!native || !user) return <>{children}</>
  if (loading || locking) return <LoadingScreen label={labels.verifyingLabel} />

  if (!unlocked) {
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
          <p>{labels.continueLabel}</p>
          <button type="button" className="btn-primary" onClick={() => void tryUnlock()}>
            {labels.unlockButton}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
