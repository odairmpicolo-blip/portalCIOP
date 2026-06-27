import { Capacitor } from '@capacitor/core'

/** Origem do portal estático (GitHub Pages / produção). */
const ORIGIN = (import.meta.env.VITE_PORTAL_ORIGIN || '').replace(/\/$/, '')

export function portalAsset(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return ORIGIN ? `${ORIGIN}${normalized}` : normalized
}

export function isNativeApp(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true
  } catch {
    /* bridge indisponível */
  }
  return typeof document !== 'undefined' && document.documentElement.classList.contains('native-app')
}
