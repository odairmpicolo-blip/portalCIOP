import { useCallback, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { injectLegacyNativeFrame } from '../lib/native-shell'
import { isNativeApp } from '../lib/portal-origin'
import { legacyUrl } from '../lib/navigation'

export function LegacyPage() {
  const params = useParams()
  const path = params['*'] || ''
  const src = useMemo(() => legacyUrl(`/${path}`), [path])
  const native = isNativeApp()

  const onFrameLoad = useCallback(
    (event: React.SyntheticEvent<HTMLIFrameElement>) => {
      if (!native) return
      try {
        const doc = event.currentTarget.contentDocument
        if (doc) injectLegacyNativeFrame(doc)
      } catch {
        /* mesma origem — falha inesperada */
      }
    },
    [native],
  )

  return (
    <section className={`legacy-page${native ? ' legacy-page--native' : ''}`}>
      {!native ? (
        <div className="legacy-toolbar">
          <Link to="/" className="btn-secondary">
            ← Voltar ao início
          </Link>
          <a href={src} target="_blank" rel="noreferrer" className="btn-ghost">
            Abrir em nova aba
          </a>
        </div>
      ) : (
        <Link to="/" className="app-native-back-fab" aria-label="Voltar ao início">
          ←
        </Link>
      )}
      <iframe
        title="Módulo legado do portal"
        src={src}
        className="legacy-frame"
        loading="lazy"
        onLoad={onFrameLoad}
      />
    </section>
  )
}
