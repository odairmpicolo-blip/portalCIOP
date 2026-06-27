/**
 * Shell nativo Capacitor — CSS, tema sistema e iframes legados.
 */

import { Capacitor } from '@capacitor/core'
import { portalAsset } from './portal-origin'
import { watchNativeTheme } from './native-theme'

const NATIVE_CSS_ID = 'portal-app-native-css'
const NATIVE_CSS_VERSION = '20260628a'

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
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  doc.documentElement.classList.toggle('native-dark', dark)
  doc.documentElement.classList.toggle('native-light', !dark)

  const viewport = doc.querySelector('meta[name="viewport"]')
  if (viewport) {
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1',
    )
  }

  if (!doc.getElementById(NATIVE_CSS_ID)) {
    const link = doc.createElement('link')
    link.id = NATIVE_CSS_ID
    link.rel = 'stylesheet'
    link.href = `${portalAsset('/assets/css/app-native.css')}?v=${NATIVE_CSS_VERSION}`
    doc.head.appendChild(link)
  }
}
