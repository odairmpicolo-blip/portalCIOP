import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { injectLegacyNativeFrame } from '../lib/native-shell'
import { useNativeApp } from '../hooks/useNativeApp'
import { legacyUrl } from '../lib/navigation'

const BUS_FRAME_SRC = legacyUrl('/pages/onibus-agora.html?embed=native-app&v=20260713b')

function postBusMode(frame: HTMLIFrameElement | null, horarios: boolean) {
  if (!frame?.contentWindow) return
  frame.contentWindow.postMessage(
    { type: 'oa-set-mode', mode: horarios ? 'horarios' : 'mapa' },
    '*',
  )
}

export function LegacyPage() {
  const params = useParams()
  const path = params['*'] || ''
  const native = useNativeApp()
  const tracking = path.includes('onibus-agora') || path.includes('onibus-horarios')
  const isHorarios = path.includes('onibus-horarios')
  const src = useMemo(() => {
    if (tracking) return BUS_FRAME_SRC
    const url = legacyUrl(`/${path}?v=20260713b`)
    if (!native) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}embed=native-app`
  }, [path, tracking, native])
  const frameRef = useRef<HTMLIFrameElement>(null)
  const frameReady = useRef(false)

  const syncNativeFrame = useCallback(
    (frame: HTMLIFrameElement | null) => {
      if (!frame) return
      if (tracking) {
        frame.setAttribute('scrolling', 'no')
        frame.style.touchAction = 'none'
        frame.style.overscrollBehavior = 'contain'
      } else {
        frame.removeAttribute('scrolling')
        frame.style.removeProperty('touch-action')
        frame.style.removeProperty('overscroll-behavior')
      }
      try {
        const doc = frame.contentDocument
        if (doc) injectLegacyNativeFrame(doc)
      } catch {
        /* mesma origem */
      }
      if (tracking) postBusMode(frame, isHorarios)
    },
    [tracking, isHorarios],
  )

  useEffect(() => {
    if (!tracking) return
    if (!frameReady.current) return
    postBusMode(frameRef.current, isHorarios)
    const timers = [50, 200, 600].map((ms) =>
      window.setTimeout(() => postBusMode(frameRef.current, isHorarios), ms),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [tracking, isHorarios])

  useEffect(() => {
    if (!native && !tracking) return
    syncNativeFrame(frameRef.current)
    const timers = [80, 400, 1200].map((ms) =>
      window.setTimeout(() => syncNativeFrame(frameRef.current), ms),
    )
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [native, tracking, src, syncNativeFrame])

  const onFrameLoad = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      frameReady.current = true
      syncNativeFrame(event.currentTarget)
    },
    [syncNativeFrame],
  )

  return (
    <section
      className={`legacy-page${native || tracking ? ' legacy-page--native' : ''}${tracking ? ' legacy-page--tracking' : ''}`}
    >
      {!native && !tracking ? (
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
        loading="eager"
        scrolling={tracking ? 'no' : undefined}
        onLoad={onFrameLoad}
      />
    </section>
  )
}
