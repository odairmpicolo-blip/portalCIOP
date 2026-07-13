/**
 * Shell nativo Capacitor — CSS, tema sistema e iframes legados.
 */

import { Capacitor } from '@capacitor/core'
import { portalAsset } from './portal-origin'
import { watchNativeTheme } from './native-theme'

const NATIVE_CSS_ID = 'portal-app-native-css'
const NATIVE_CSS_VERSION = '20260713a'

export function isNativePlatform(): boolean {
  try {
    if (document.documentElement.classList.contains('native-app')) return true
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

function injectNativeStylesheet(): void {
  if (document.getElementById(NATIVE_CSS_ID)) return
  const link = document.createElement('link')
  link.id = NATIVE_CSS_ID
  link.rel = 'stylesheet'
  link.href = `${portalAsset('/assets/css/app-native.css')}?v=${NATIVE_CSS_VERSION}`
  document.head.appendChild(link)
}

export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  document.documentElement.classList.add('native-app')
  injectNativeStylesheet()
  watchNativeTheme()
}

/** Aplica tema app dentro de iframes legados (mesma origem). */
export function injectLegacyNativeFrame(doc: Document): void {
  if (!isNativePlatform()) return

  doc.documentElement.classList.add('native-app', 'native-embedded')
  doc.documentElement.style.height = '100%'
  if (doc.body) doc.body.style.height = '100%'

  const parentStyle = getComputedStyle(document.documentElement)
  const safeTop = parentStyle.getPropertyValue('--safe-top').trim() || 'env(safe-area-inset-top, 0px)'
  const safeBottom = parentStyle.getPropertyValue('--safe-bottom').trim() || 'env(safe-area-inset-bottom, 0px)'
  const navH = parentStyle.getPropertyValue('--app-nav-h').trim() || '72px'
  doc.documentElement.style.setProperty('--oa-parent-safe-top', safeTop)
  doc.documentElement.style.setProperty('--oa-parent-safe-bottom', safeBottom)
  doc.documentElement.style.setProperty('--oa-parent-nav-h', navH)

  const dark = document.documentElement.classList.contains('native-dark')
  doc.documentElement.classList.toggle('native-dark', dark)
  doc.documentElement.classList.toggle('native-light', !dark)

  let viewport = doc.querySelector('meta[name="viewport"]')
  if (!viewport) {
    viewport = doc.createElement('meta')
    viewport.setAttribute('name', 'viewport')
    doc.head.appendChild(viewport)
  }
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
  )

  const existingLink = doc.getElementById(NATIVE_CSS_ID) as HTMLLinkElement | null
  if (!existingLink) {
    const link = doc.createElement('link')
    link.id = NATIVE_CSS_ID
    link.rel = 'stylesheet'
    link.href = `${portalAsset('/assets/css/app-native.css')}?v=${NATIVE_CSS_VERSION}`
    doc.head.appendChild(link)
  } else if (!existingLink.href.includes(`v=${NATIVE_CSS_VERSION}`)) {
    existingLink.href = `${portalAsset('/assets/css/app-native.css')}?v=${NATIVE_CSS_VERSION}`
  }

  if (!doc.getElementById('oa-safe-area-bridge')) {
    const style = doc.createElement('style')
    style.id = 'oa-safe-area-bridge'
    style.textContent = `
      html.native-embedded {
        --safe-top: max(env(safe-area-inset-top, 0px), var(--oa-parent-safe-top, 44px));
        --safe-bottom: max(env(safe-area-inset-bottom, 0px), var(--oa-parent-safe-bottom, 34px));
        --oa-tab-bar-h: var(--oa-parent-nav-h, 72px);
      }
    `
    doc.head.appendChild(style)
  }

  const frameWin = doc.defaultView as (Window & { portalReinitNativeMode?: () => void }) | null
  frameWin?.portalReinitNativeMode?.()
}
