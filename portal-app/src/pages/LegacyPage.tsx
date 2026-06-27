import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { injectLegacyNativeFrame } from '../lib/native-shell'
import { useNativeApp } from '../hooks/useNativeApp'
import { legacyUrl } from '../lib/navigation'

export function LegacyPage() {
  const params = useParams()
  const path = params['*'] || ''
  const src = useMemo(() => legacyUrl(`/${path}`), [path])
  const native = useNativeApp()
  const tracking = path.includes('onibus-agora') || path.includes('onibus-horarios')
  const frameRef = useRef<HTMLIFrameElement>(null)

  const syncNativeFrame = useCallback((frame: HTMLIFrameElement | null) => {
    if (!native || !frame) return
    try {
      const doc = frame.contentDocument
      if (doc) injectLegacyNativeFrame(doc)
    } catch {
      /* mesma origem — falha inesperada */
    }
  }, [native])

  useEffect(() => {
    if (!native) return
    syncNativeFrame(frameRef.current)
    const t1 = window.setTimeout(() => syncNativeFrame(frameRef.current), 80)
    const t2 = window.setTimeout(() => syncNativeFrame(frameRef.current), 400)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [native, src, syncNativeFrame])

  const onFrameLoad = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      syncNativeFrame(event.currentTarget)
    },
    [syncNativeFrame],
  )

  return (
    <section
      className={`legacy-page${native ? ' legacy-page--native' : ''}${tracking ? ' legacy-page--tracking' : ''}`}
    >
      {!native ? (
        <div className="legacy-toolbar">
          <Link to="/" className="btn-secondary">
            ← Voltar ao início
          </Link>
          <a href={src} target="_blank" rel="noreferrer" className="btn-ghost">
            Abrir em nova aba
          </a>
        </div>
      ) : null}
      <iframe
        ref={frameRef}
        title="Módulo legado do portal"
        src={src}
        className="legacy-frame"
        loading="lazy"
        onLoad={onFrameLoad}
      />
    </section>
  )
}
