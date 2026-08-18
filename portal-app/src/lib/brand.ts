import { portalAsset } from './portal-origin'
import { getThemeMode } from './app-preferences'

export function portalBrandSrc(dark?: boolean, login = false): string {
  const isDark =
    dark ??
    (document.documentElement.classList.contains('dk-dark') ||
      document.documentElement.classList.contains('native-dark') ||
      getThemeMode() === 'dark')
  const file = isDark
    ? login
      ? 'logomarca-portalciop-tcgl-escuro-login.png'
      : 'logomarca-portalciop-tcgl-escuro.png'
    : login
      ? 'logomarca-portalciop-tcgl-claro-login.png'
      : 'logomarca-portalciop-tcgl-claro.png'
  return portalAsset(`/assets/img/${file}?v=20260818logo`)
}
