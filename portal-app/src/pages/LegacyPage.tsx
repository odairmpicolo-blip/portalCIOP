import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { legacyUrl } from '../lib/navigation'

export function LegacyPage() {
  const params = useParams()
  const path = params['*'] || ''
  const src = useMemo(() => legacyUrl(`/${path}`), [path])

  return (
    <section className="legacy-page">
      <div className="legacy-toolbar">
        <Link to="/" className="btn-secondary">
          ← Voltar ao início
        </Link>
        <a href={src} target="_blank" rel="noreferrer" className="btn-ghost">
          Abrir em nova aba
        </a>
      </div>
      <iframe
        title="Módulo legado do portal"
        src={src}
        className="legacy-frame"
        loading="lazy"
      />
    </section>
  )
}
