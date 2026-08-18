import { portalAsset } from './portal-origin'
import { getThemeMode } from './app-preferences'

export function portalBrandSrc(dark?: boolean): string {
  const isDark =
    dark ??
    (document.documentElement.classList.contains('dk-dark') ||
      document.documentElement.classList.contains('native-dark') ||
      getThemeMode() === 'dark')
  const file = isDark ? 'logomarca-portalciop-tcgl-escuro.png' : 'logomarca-portalciop-tcgl-claro.png'
  return portalAsset(`/assets/img/${file}?v=20260818p`)
}
