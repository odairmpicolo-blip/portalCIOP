/** Origem do portal estático (GitHub Pages / produção). */
const ORIGIN = (import.meta.env.VITE_PORTAL_ORIGIN || '').replace(/\/$/, '')

export function portalAsset(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return ORIGIN ? `${ORIGIN}${normalized}` : normalized
}

export function isNativeApp(): boolean {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('native-app')) {
    return true
  }
  try {
    const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
    return cap?.isNativePlatform?.() === true
  } catch {
    return false
  }
}
