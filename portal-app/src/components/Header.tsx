import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { portalAsset } from '../lib/portal-origin'

function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const first = parts[0][0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

export function Header({
  onMenuToggle,
  native = false,
  home = false,
}: {
  onMenuToggle: () => void
  native?: boolean
  home?: boolean
}) {
  const { user, logout } = useAuth()
  const brandSrc = portalAsset('/assets/img/titulo-portal-ciop.png')

  return (
    <header className="app-header">
      <div className="header-left">
        {!native ? (
          <button type="button" className="menu-toggle" onClick={onMenuToggle} aria-label="Abrir menu">
            <span className="menu-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        ) : null}
        <div className="brand portal-brand-mark" aria-label="Portal CIOP TCGL Operações">
          <img className="portal-brand-art" src={brandSrc} alt="Portal CIOP" />
          <span className="portal-brand-meta">TCGL · Operações</span>
        </div>
      </div>

      <div className={`header-brand-mobile portal-brand-mark${home ? ' header-brand-mobile--hidden' : ''}`} aria-hidden="true">
        <img className="portal-brand-art" src={brandSrc} alt="" />
        <span className="portal-brand-meta">TCGL · Operações</span>
      </div>

      <div className="header-right">
        <a href="/" className="btn-legacy-portal" title="Voltar ao portal clássico">
          Portal clássico
        </a>
        <div className="session-chip session-chip-modern" aria-label="Sessão do usuário">
          <span className="session-avatar" aria-hidden="true">{initials(user?.nome)}</span>
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
