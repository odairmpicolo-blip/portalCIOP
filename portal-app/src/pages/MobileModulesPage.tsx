import { Link } from 'react-router-dom'
import { ModuleIcon } from '../lib/mobile-icons'
import { portalCards, cardRoute } from '../lib/navigation'
import { useAuth } from '../hooks/useAuth'
import { usuarioPodeAcessar } from '../lib/permissions'

export function MobileModulesPage() {
  const { user } = useAuth()
  const cards = portalCards.filter((c) => usuarioPodeAcessar(user, c.access))

  return (
    <div className="mobile-modules-page">
      <header className="mobile-modules-hero">
        <p className="mobile-modules-eyebrow">Portal CIOP</p>
        <h1>Módulos</h1>
        <p>Acesso rápido à operação e dashboards.</p>
      </header>
      <div className="mobile-modules-grid">
        {cards.map((card) => {
          const route = cardRoute(card)
          const inner = (
            <>
              <span className={`mobile-module-icon theme-${card.theme}`}>
                <ModuleIcon id={card.id} />
              </span>
              <span className="mobile-module-label">{card.title}</span>
            </>
          )
          if (route) {
            return (
              <Link key={card.id} to={route} className="mobile-module-tile">
                {inner}
              </Link>
            )
          }
          return (
            <a key={card.id} href={card.href} className="mobile-module-tile" target="_blank" rel="noreferrer">
              {inner}
            </a>
          )
        })}
      </div>
    </div>
  )
}
