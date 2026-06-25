import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, logout } = useAuth()

  return (
    <header className="app-header">
      <div className="header-left">
        <button type="button" className="menu-toggle" onClick={onMenuToggle} aria-label="Abrir menu">
          <span className="menu-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <div className="brand portal-brand-mark" aria-label="Portal CIOP TCGL Operações">
          <span className="portal-brand-name">Portal CI<span className="portal-brand-o">O</span>P</span>
          <span className="portal-brand-meta">TCGL · Operações</span>
        </div>
      </div>

      <div className="header-right">
        <a href="/" className="btn-legacy-portal" title="Voltar ao portal clássico">
          Portal clássico
        </a>
        <div className="session-chip session-chip-modern" aria-label="Sessão do usuário">
          <div className="session-info">
            <span className="session-name">{user?.nome || 'Usuário'}</span>
            {user?.cargo ? <span className="session-profile">{user.cargo}</span> : null}
          </div>
          <div className="session-actions">
            <button type="button" className="btn-logout" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export function HeaderPortalLink() {
  return (
    <Link to="/" className="btn-secondary">
      Início
    </Link>
  )
}
