import { createContext, useContext } from 'react'
import type { ThemeMode } from '../lib/app-preferences'

export type AppPreferencesContextValue = {
  biometricEnabled: boolean
  setBiometricEnabled: (enabled: boolean) => void
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

export const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null)

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext)
  if (!ctx) throw new Error('useAppPreferences deve ser usado dentro de AppPreferencesProvider')
  return ctx
}
