import { App } from '@capacitor/app'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getBiometryLabels, isBiometricAvailable, promptBiometric } from '../lib/biometric-auth'
import { isBiometricEnabled } from '../lib/app-preferences'
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
  const { biometricEnabled } = useAppPreferences()
  const [unlocked, setUnlocked] = useState(() => !native)
  const [locking, setLocking] = useState(false)
  const unlockInFlight = useRef(false)

  const tryUnlock = useCallback(async (): Promise<boolean> => {
    if (!native || !biometricEnabled || !isBiometricEnabled()) {
      setUnlocked(true)
      return true
    }

    const available = await isBiometricAvailable()
    if (!available) {
      setUnlocked(true)
      return true
    }

    if (unlockInFlight.current) {
      unlockInFlight.current = false
    }

    unlockInFlight.current = true
    setLocking(true)
    try {
      const labels = await getBiometryLabels()
      const ok = await promptBiometric(labels.promptUnlock)
      if (ok) markBiometricUnlocked()
      setUnlocked(ok)
      return ok
    } finally {
      unlockInFlight.current = false
      setLocking(false)
    }
  }, [native, biometricEnabled])

  useEffect(() => {
    if (!native || !biometricEnabled) {
      setUnlocked(true)
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
    // iOS exige gesto do usuário — não abrir Face ID automaticamente.
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
    }),
    [unlocked, locking, native, biometricEnabled, tryUnlock],
  )

  return <BiometricContext.Provider value={value}>{children}</BiometricContext.Provider>
}
