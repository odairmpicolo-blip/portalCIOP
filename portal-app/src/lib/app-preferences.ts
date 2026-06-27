import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const BIOMETRIC_KEY = 'portal.biometricEnabled'
const THEME_KEY = 'portal.themeMode'

const LIGHT_BG = '#f0f4fa'
const DARK_BG = '#070d18'

export type ThemeMode = 'light' | 'dark'

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_KEY) !== '0'
  } catch {
    return true
  }
}

export function setBiometricEnabled(enabled: boolean): void {
  localStorage.setItem(BIOMETRIC_KEY, enabled ? '1' : '0')
}

export function getThemeMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_KEY, mode)
  applyThemeMode(mode)
}

export function applyThemeMode(mode?: ThemeMode): void {
  const resolved = mode ?? getThemeMode()
  const root = document.documentElement
  root.classList.toggle('native-dark', resolved === 'dark')
  root.classList.toggle('native-light', resolved === 'light')

  if (!Capacitor.isNativePlatform()) return

  void (async () => {
    try {
      await StatusBar.setStyle({ style: resolved === 'dark' ? Style.Dark : Style.Light })
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: resolved === 'dark' ? DARK_BG : LIGHT_BG })
      }
    } catch {
      /* opcional */
    }
  })()
}

export function watchThemePreference(onChange: () => void): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === BIOMETRIC_KEY) onChange()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
