import { applyThemeMode, getThemeMode } from './app-preferences'

export { applyThemeMode, getThemeMode, setThemeMode, type ThemeMode } from './app-preferences'

export function syncNativeTheme(): void {
  applyThemeMode(getThemeMode())
}

export function watchNativeTheme(): () => void {
  syncNativeTheme()
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    try {
      if (!localStorage.getItem('portal.themeMode')) applyThemeMode()
    } catch {
      applyThemeMode()
    }
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
