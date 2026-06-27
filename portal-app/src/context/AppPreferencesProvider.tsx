import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  applyThemeMode,
  getThemeMode,
  isBiometricEnabled,
  setBiometricEnabled as persistBiometric,
  setThemeMode as persistTheme,
  type ThemeMode,
} from '../lib/app-preferences'
import { AppPreferencesContext, type AppPreferencesContextValue } from './app-preferences-context'

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [biometricEnabled, setBiometricEnabledState] = useState(isBiometricEnabled)
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const mode = getThemeMode()
    applyThemeMode(mode)
    return mode
  })

  const setBiometricEnabled = useCallback((enabled: boolean) => {
    persistBiometric(enabled)
    setBiometricEnabledState(enabled)
  }, [])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    persistTheme(mode)
    setThemeModeState(mode)
    document.querySelectorAll('iframe.legacy-frame').forEach((frame) => {
      try {
        const doc = (frame as HTMLIFrameElement).contentDocument
        if (!doc) return
        doc.documentElement.classList.toggle('native-dark', mode === 'dark')
        doc.documentElement.classList.toggle('native-light', mode === 'light')
      } catch {
        /* cross-origin */
      }
    })
  }, [])

  const value = useMemo<AppPreferencesContextValue>(
    () => ({ biometricEnabled, setBiometricEnabled, themeMode, setThemeMode }),
    [biometricEnabled, setBiometricEnabled, themeMode, setThemeMode],
  )

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>
}
