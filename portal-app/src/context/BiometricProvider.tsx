import { App } from '@capacitor/app'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { promptBiometric } from '../lib/biometric-auth'
import { consumeBiometricSkip } from '../lib/biometric-session'
import { isNativeApp } from '../lib/portal-origin'
import { useAuth } from '../hooks/useAuth'
import { BiometricContext, type BiometricContextValue } from './biometric-context'

export function BiometricProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const native = isNativeApp()
  const [unlocked, setUnlocked] = useState(!native)
  const [locking, setLocking] = useState(false)
  const unlockInFlight = useRef(false)

  const lock = useCallback(() => {
    if (!native) return
    setUnlocked(false)
  }, [native])

  const tryUnlock = useCallback(async (): Promise<boolean> => {
    if (!native) {
      setUnlocked(true)
      return true
    }
    if (unlockInFlight.current) return false
    unlockInFlight.current = true
    setLocking(true)
    try {
      const ok = await promptBiometric(undefined)
      setUnlocked(ok)
      return ok
    } finally {
      unlockInFlight.current = false
      setLocking(false)
    }
  }, [native])

  useEffect(() => {
    if (!native) {
      setUnlocked(true)
      return
    }
    if (!user) {
      setUnlocked(false)
      return
    }
    if (consumeBiometricSkip()) {
      setUnlocked(true)
      return
    }
    setUnlocked(false)
    void tryUnlock()
  }, [native, user, tryUnlock])

  useEffect(() => {
    if (!native || !user) return
    let removed = false
    let handle: { remove: () => Promise<void> } | undefined

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && user) {
        lock()
        void tryUnlock()
      }
    }).then((listener) => {
      if (removed) {
        void listener.remove()
        return
      }
      handle = listener
    })

    return () => {
      removed = true
      void handle?.remove()
    }
  }, [native, user, lock, tryUnlock])

  const value = useMemo<BiometricContextValue>(
    () => ({ unlocked, locking, lock, tryUnlock }),
    [unlocked, locking, lock, tryUnlock],
  )

  return <BiometricContext.Provider value={value}>{children}</BiometricContext.Provider>
}
