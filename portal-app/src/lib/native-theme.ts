import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

const LIGHT_BG = '#f0f4fa'
const DARK_BG = '#070d18'

export function syncNativeTheme(): void {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const root = document.documentElement
  root.classList.toggle('native-dark', dark)
  root.classList.toggle('native-light', !dark)

  if (!Capacitor.isNativePlatform()) return

  void (async () => {
    try {
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: dark ? DARK_BG : LIGHT_BG })
      }
    } catch {
      /* opcional */
    }
  })()
}

export function watchNativeTheme(): () => void {
  syncNativeTheme()
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => syncNativeTheme()
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
