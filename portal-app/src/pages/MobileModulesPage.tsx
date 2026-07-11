import { Link } from 'react-router-dom'
import { ModuleIcon } from '../lib/mobile-icons'
import { portalCards, cardRoute, type PortalCard } from '../lib/navigation'
import { useAuth } from '../hooks/useAuth'
import { usuarioPodeAcessar } from '../lib/permissions'

function ModuleTile({ card }: { card: PortalCard }) {
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
      <Link to={route} className="mobile-module-tile">
        {inner}
      </Link>
    )
  }
  return (
    <a href={card.href} className="mobile-module-tile" target="_blank" rel="noreferrer">
      {inner}
    </a>
  )
}

export function MobileModulesPage() {
  const { user, logout } = useAuth()
  const dashboards = portalCards.filter(
    (c) => c.section === 'dashboards' && usuarioPodeAcessar(user, c.access),
  )
  const ciop = portalCards.filter((c) => c.section === 'operacao' && usuarioPodeAcessar(user, c.access))
  const primeiroNome = user?.nome?.split(' ')[0] || 'usuário'

  return (
    <div className="mobile-modules-page">
      <header className="mobile-modules-hero mobile-inicio-hero">
        <div className="mobile-inicio-head">
          <div>
            <p className="mobile-modules-eyebrow">Portal Operacional</p>
            <h1>Bem-vindo, {primeiroNome}</h1>
          </div>
          <button type="button" className="inicio-logout-btn" onClick={() => void logout()}>
            Sair
          </button>
        </div>
        <p className="mobile-inicio-sub">
          Perfil <strong>{user?.perfil}</strong> · módulos CIOP/TCGL
        </p>
      </header>

      <div className="mobile-modules-grid">
        {dashboards.map((card) => (
          <ModuleTile key={card.id} card={card} />
        ))}
      </div>

      {ciop.length ? (
        <>
          <h2 className="mobile-modules-section-title">CIOP</h2>
          <div className="mobile-modules-grid">
            {ciop.map((card) => (
              <ModuleTile key={card.id} card={card} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
