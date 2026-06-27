import { NavLink, useLocation } from 'react-router-dom'
import { TabIcon } from '../lib/mobile-icons'

type MobileTabBarProps = {
  onMenuOpen: () => void
  onAvisos?: () => void
}

export function MobileTabBar({ onMenuOpen, onAvisos }: MobileTabBarProps) {
  const { pathname } = useLocation()
  const inLegado = pathname.startsWith('/legado')

  return (
    <nav className="mobile-tab-bar" aria-label="Navegação principal">
      <NavLink to="/" className={({ isActive }) => `mobile-tab${isActive && !inLegado && pathname !== '/modulos' ? ' active' : ''}`} end>
        <TabIcon name="home" className="mobile-tab-icon" />
        <span>Início</span>
      </NavLink>
      <NavLink to="/modulos" className={({ isActive }) => `mobile-tab${isActive || inLegado ? ' active' : ''}`}>
        <TabIcon name="grid" className="mobile-tab-icon" />
        <span>Módulos</span>
      </NavLink>
      {onAvisos ? (
        <button type="button" className="mobile-tab" onClick={onAvisos}>
          <TabIcon name="bell" className="mobile-tab-icon" />
          <span>Avisos</span>
        </button>
      ) : null}
      <button type="button" className="mobile-tab" onClick={onMenuOpen}>
        <TabIcon name="menu" className="mobile-tab-icon" />
        <span>Links</span>
      </button>
    </nav>
  )
}
