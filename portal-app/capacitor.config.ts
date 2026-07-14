import type { CapacitorConfig } from '@capacitor/cli'

/**
 * App mobile interno (Android + iOS) — WebView Capacitor apontando para produção.
 * Sem Play Store / App Store; instalação manual restrita.
 */
const PORTAL_URL = process.env.CAPACITOR_PORTAL_URL || 'https://www.portalciop.com.br/app/'
const USE_BUNDLE = process.env.CAPACITOR_BUNDLE === '1'

const config: CapacitorConfig = {
  appId: 'com.portalciop.internal',
  appName: 'Portal CIOP',
  webDir: USE_BUNDLE ? '../app' : 'www',
  ...(USE_BUNDLE
    ? {}
    : {
        server: {
          url: PORTAL_URL,
          cleartext: false,
          androidScheme: 'https',
          allowNavigation: [
            'www.portalciop.com.br',
            'portalciop.com.br',
            '*.portalciop.com.br',
            'portal-ciop.firebaseapp.com',
            '*.googleapis.com',
            '*.google.com',
            'accounts.google.com',
            'odairmpicolo-blip.github.io',
          ],
        },
      }),
  android: {
    allowMixedContent: false,
    backgroundColor: '#0f172a',
  },
  ios: {
    backgroundColor: '#0f172a',
    // 'automatic' reserva um "gutter" nativo (cor sólida, fora do alcance
    // do CSS) atrás da status bar/dynamic island. Com 'never' o WKWebView
    // desenha em full-bleed e o próprio gradiente do body (que já respeita
    // env(safe-area-inset-top) via app-native.css) aparece por trás do
    // notch, em vez de uma faixa sólida separada.
    contentInset: 'never',
    scrollEnabled: true,
    preferredContentMode: 'mobile',
  },
}

export default config
