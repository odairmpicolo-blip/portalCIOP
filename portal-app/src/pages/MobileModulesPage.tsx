import { Link } from 'react-router-dom'
import { ModuleIcon } from '../lib/mobile-icons'
import { portalCards, cardRoute } from '../lib/navigation'
import { useAuth } from '../hooks/useAuth'
import { usuarioPodeAcessar } from '../lib/permissions'

export function MobileModulesPage() {
  const { user, logout } = useAuth()
  const cards = portalCards.filter((c) => usuarioPodeAcessar(user, c.access))
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
