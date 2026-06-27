import { App } from '@capacitor/app'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isBiometricEnabled } from '../lib/app-preferences'
import { promptBiometric } from '../lib/biometric-auth'
import {
  BACKGROUND_LOCK_MS,
  consumeBiometricSkip,
  isBiometricSessionValid,
  markBiometricUnlocked,
} from '../lib/biometric-session'
import { useAppPreferences } from './app-preferences-context'
import { useAuth } from '../hooks/useAuth'
import { useNativeApp } from '../hooks/useNativeApp'
import { BiometricContext, type BiometricContextValue } from './biometric-context'

export function BiometricProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const native = useNativeApp()
  const { biometricEnabled } = useAppPreferences()
  const [unlocked, setUnlocked] = useState(() => !native)
  const [locking, setLocking] = useState(false)
  const unlockInFlight = useRef(false)
  const backgroundedAt = useRef<number | null>(null)
  const initialUnlockStarted = useRef(false)

  const tryUnlock = useCallback(async (options?: { silent?: boolean }): Promise<boolean> => {
    if (!native || !biometricEnabled || !isBiometricEnabled()) {
      setUnlocked(true)
      return true
    }
    if (unlockInFlight.current) return false
    unlockInFlight.current = true
    if (!options?.silent) setLocking(true)
    try {
      const ok = await promptBiometric()
      if (ok) markBiometricUnlocked()
      setUnlocked(ok)
      return ok
    } finally {
      unlockInFlight.current = false
      if (!options?.silent) setLocking(false)
    }
  }, [native, biometricEnabled])

  useEffect(() => {
    if (!native || !biometricEnabled) {
      setUnlocked(true)
      initialUnlockStarted.current = false
      return
    }
    if (!user) {
      setUnlocked(false)
      initialUnlockStarted.current = false
      return
    }
    if (consumeBiometricSkip() || isBiometricSessionValid()) {
      setUnlocked(true)
      return
    }
    if (initialUnlockStarted.current) return
    initialUnlockStarted.current = true
    setUnlocked(false)
    void tryUnlock()
  }, [native, user, tryUnlock, biometricEnabled])

  useEffect(() => {
    if (!native || !user || !biometricEnabled) return
    let removed = false
    let handle: { remove: () => Promise<void> } | undefined

    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt.current = Date.now()
        return
      }
      if (!user) return

      const awayMs = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0
      backgroundedAt.current = null

      if (awayMs < BACKGROUND_LOCK_MS && isBiometricSessionValid()) {
        setUnlocked(true)
        return
      }

      setUnlocked(false)
      void tryUnlock({ silent: true })
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
  }, [native, user, tryUnlock, biometricEnabled])

  const value = useMemo<BiometricContextValue>(
    () => ({
      unlocked,
      locking,
      lock: () => {
        if (!native) return
        setUnlocked(false)
      },
      tryUnlock: () => tryUnlock(),
    }),
    [unlocked, locking, native, tryUnlock],
  )

  return <BiometricContext.Provider value={value}>{children}</BiometricContext.Provider>
}
