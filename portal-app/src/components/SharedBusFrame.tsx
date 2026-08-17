import { useCallback, useEffect, useRef } from 'react'
import { injectLegacyNativeFrame } from '../lib/native-shell'
import { legacyUrl } from '../lib/navigation'

const BUS_FRAME_SRC = legacyUrl('/pages/onibus-agora.html?embed=native-app')

type SharedBusFrameProps = {
  horarios: boolean
}

function postBusMode(frame: HTMLIFrameElement | null, horarios: boolean) {
  frame?.contentWindow?.postMessage(
    { type: 'oa-set-mode', mode: horarios ? 'horarios' : 'mapa' },
    '*',
  )
}

/** Iframe único Ônibus/Horários — persiste ao trocar abas (sem recarregar auth). */
export function SharedBusFrame({ horarios }: SharedBusFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const ready = useRef(false)

  const applyMode = useCallback(() => {
    postBusMode(frameRef.current, horarios)
  }, [horarios])

  const injectFrame = useCallback(() => {
    const frame = frameRef.current
    if (!frame) return
    try {
      const doc = frame.contentDocument
      if (doc) injectLegacyNativeFrame(doc)
    } catch {
      /* mesma origem */
    }
    postBusMode(frame, horarios)
  }, [horarios])

  useEffect(() => {
    if (!ready.current) return
    applyMode()
    const timers = [50, 200, 600].map((ms) => window.setTimeout(applyMode, ms))
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [horarios, applyMode])

  const onLoad = useCallback(() => {
    ready.current = true
    injectFrame()
  }, [injectFrame])

  return (
    <section className="legacy-page legacy-page--native legacy-page--tracking">
      <iframe
        ref={frameRef}
        title="Ônibus e horários"
        src={BUS_FRAME_SRC}
        className="legacy-frame"
        loading="eager"
        onLoad={onLoad}
      />
    </section>
  )
}
