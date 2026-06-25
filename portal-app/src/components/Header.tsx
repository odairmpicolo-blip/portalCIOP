import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { user, logout } = useAuth()

  return (
    <header className="app-header">
      <div className="header-left">
        <button type="button" className="menu-toggle" onClick={onMenuToggle} aria-label="Abrir menu">
          ☰
        </button>
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL}assets/img/titulo-portal-ciop.png`}
            alt="Portal CIOP"
            className="brand-title-art"
          />
          <span className="brand-subtitle">TCGL · Operações</span>
        </div>
      </div>

      <div className="header-right">
        <div className="session-chip" aria-label="Sessão do usuário">
          <span className="session-name">{user?.nome || 'Usuário'}</span>
          <span className="session-profile">{user?.perfil || 'Perfil'}</span>
        </div>
        <button type="button" className="btn-logout" onClick={() => void logout()}>
          Sair
        </button>
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
