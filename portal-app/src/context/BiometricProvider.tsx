import { App } from '@capacitor/app'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  isBiometricAvailable,
  preloadBiometricAuth,
  promptBiometricFromGesture,
} from '../lib/biometric-auth'
import { isBiometricEnabled, setBiometricEnabled as persistBiometricEnabled } from '../lib/app-preferences'
import {
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
  const { biometricEnabled, setBiometricEnabled } = useAppPreferences()
  const [unlocked, setUnlocked] = useState(() => !native)
  const [locking, setLocking] = useState(false)
  const unlockInFlight = useRef(false)
  const hardwareUnavailable = useRef(false)

  useEffect(() => {
    if (!native) return
    preloadBiometricAuth()
    void isBiometricAvailable().then((available) => {
      hardwareUnavailable.current = !available
      if (!available && biometricEnabled) setUnlocked(true)
    })
  }, [native, biometricEnabled])

  const tryUnlock = useCallback((): Promise<boolean> => {
    if (!native || !biometricEnabled || !isBiometricEnabled() || hardwareUnavailable.current) {
      setUnlocked(true)
      return Promise.resolve(true)
    }

    if (unlockInFlight.current) {
      return Promise.resolve(false)
    }

    unlockInFlight.current = true
    setLocking(true)

    // Sem await antes de authenticate — exigência do iOS.
    return promptBiometricFromGesture()
      .then((ok) => {
        if (ok) markBiometricUnlocked()
        setUnlocked(ok)
        return ok
      })
      .finally(() => {
        unlockInFlight.current = false
        setLocking(false)
      })
  }, [native, biometricEnabled])

  const skipBiometric = useCallback(() => {
    persistBiometricEnabled(false)
    setBiometricEnabled(false)
    markBiometricUnlocked()
    setUnlocked(true)
  }, [setBiometricEnabled])

  useEffect(() => {
    if (!native || !biometricEnabled) {
      queueMicrotask(() => setUnlocked(true))
      return
    }
    if (!user) {
      setUnlocked(false)
      return
    }
    if (consumeBiometricSkip() || isBiometricSessionValid()) {
      setUnlocked(true)
      return
    }
    setUnlocked(false)
  }, [native, user, biometricEnabled])

  useEffect(() => {
    if (!native || !user || !biometricEnabled) return
    let removed = false
    let handle: { remove: () => Promise<void> } | undefined

    void App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      if (!user) return
      if (isBiometricSessionValid()) {
        setUnlocked(true)
        return
      }
      setUnlocked(false)
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
  }, [native, user, biometricEnabled])

  const value = useMemo<BiometricContextValue>(
    () => ({
      unlocked,
      locking,
      lock: () => {
        if (!native || !biometricEnabled) return
        setUnlocked(false)
      },
      tryUnlock,
      skipBiometric,
    }),
    [unlocked, locking, native, biometricEnabled, tryUnlock, skipBiometric],
  )

  return <BiometricContext.Provider value={value}>{children}</BiometricContext.Provider>
}
