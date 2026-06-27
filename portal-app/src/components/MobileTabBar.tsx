import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { TabIcon } from '../lib/mobile-icons'
import { onibusAgoraCard, onibusAgoraRoute } from '../lib/navigation'
import { usuarioPodeAcessar } from '../lib/permissions'

type MobileTabBarProps = {
  onMenuOpen: () => void
  onAvisos?: () => void
}

export function MobileTabBar({ onMenuOpen, onAvisos }: MobileTabBarProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const inOnibus = pathname.includes('onibus-agora')
  const inLegado = pathname.startsWith('/legado') && !inOnibus
  const podeLinhas = onibusAgoraCard && onibusAgoraRoute && usuarioPodeAcessar(user, onibusAgoraCard.access)

  return (
    <nav className="mobile-tab-bar" aria-label="Navegação principal">
      <NavLink
        to="/modulos"
        className={({ isActive }) =>
          `mobile-tab${isActive || inLegado ? ' active' : ''}`
        }
      >
        <TabIcon name="grid" className="mobile-tab-icon" />
        <span>Módulos</span>
      </NavLink>
      <NavLink
        to="/"
        className={({ isActive }) =>
          `mobile-tab${isActive && pathname === '/' ? ' active' : ''}`
        }
        end
      >
        <TabIcon name="home" className="mobile-tab-icon" />
        <span>Início</span>
      </NavLink>
      <button type="button" className="mobile-tab" onClick={onMenuOpen}>
        <TabIcon name="menu" className="mobile-tab-icon" />
        <span>Links</span>
      </button>
      {podeLinhas && onibusAgoraRoute ? (
        <NavLink
          to={onibusAgoraRoute}
          className={() => `mobile-tab${inOnibus ? ' active' : ''}`}
        >
          <TabIcon name="linhas" className="mobile-tab-icon" />
          <span>Linhas</span>
        </NavLink>
      ) : null}
      {onAvisos ? (
        <button type="button" className="mobile-tab" onClick={onAvisos}>
          <TabIcon name="bell" className="mobile-tab-icon" />
          <span>Avisos</span>
        </button>
      ) : null}
    </nav>
  )
}
