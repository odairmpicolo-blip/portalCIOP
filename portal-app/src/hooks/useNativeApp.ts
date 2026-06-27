import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'

function detectNativeApp(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true
  } catch {
    /* bridge indisponível */
  }
  return typeof document !== 'undefined' && document.documentElement.classList.contains('native-app')
}

/** Detecta app Capacitor (bridge pode carregar um tick após o primeiro render). */
export function useNativeApp(): boolean {
  const [native, setNative] = useState(detectNativeApp)

  useEffect(() => {
    const sync = () => {
      const next = detectNativeApp()
      if (next) document.documentElement.classList.add('native-app')
      setNative(next)
    }
    sync()
    const t1 = window.setTimeout(sync, 0)
    const t2 = window.setTimeout(sync, 120)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [])

  return native
}
