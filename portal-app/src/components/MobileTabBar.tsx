import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { TabIcon } from '../lib/mobile-icons'
import { onibusAgoraCard, onibusAgoraRoute, onibusHorariosCard, onibusHorariosRoute } from '../lib/navigation'
import { usuarioPodeAcessar } from '../lib/permissions'

type MobileTabBarProps = {
  sidebarOpen?: boolean
  onMenuToggle: () => void
}

export function MobileTabBar({ sidebarOpen, onMenuToggle }: MobileTabBarProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const inHorarios = pathname.includes('onibus-horarios')
  const inOnibus = pathname.includes('onibus-agora') && !inHorarios
  const inAjustes = pathname === '/ajustes'
  const inLegado = pathname.startsWith('/legado')
  const inInicio =
    pathname === '/' ||
    pathname === '/modulos' ||
    (inLegado && !inOnibus && !inHorarios)

  const podeBus2 = onibusAgoraCard && usuarioPodeAcessar(user, onibusAgoraCard.access)
  const podeOnibus = podeBus2 && onibusAgoraRoute
  const podeHorarios =
    onibusHorariosCard && onibusHorariosRoute && usuarioPodeAcessar(user, onibusHorariosCard.access)

  return (
    <nav className="mobile-tab-bar" aria-label="Navegação principal">
      <NavLink to="/" className={() => `mobile-tab${inInicio ? ' active' : ''}`} end>
        <TabIcon name="home" className="mobile-tab-icon" />
        <span>Início</span>
      </NavLink>
      {podeOnibus ? (
        <NavLink to={onibusAgoraRoute!} className={() => `mobile-tab${inOnibus ? ' active' : ''}`}>
          <TabIcon name="onibus" className="mobile-tab-icon" />
          <span>Ônibus</span>
        </NavLink>
      ) : null}
      {podeHorarios ? (
        <NavLink to={onibusHorariosRoute!} className={() => `mobile-tab${inHorarios ? ' active' : ''}`}>
          <TabIcon name="horarios" className="mobile-tab-icon" />
          <span>Horários</span>
        </NavLink>
      ) : null}
      <button type="button" className={`mobile-tab${sidebarOpen ? ' active' : ''}`} onClick={onMenuToggle}>
        <TabIcon name="menu" className="mobile-tab-icon" />
        <span>Links</span>
      </button>
      <NavLink to="/ajustes" className={() => `mobile-tab${inAjustes ? ' active' : ''}`}>
        <TabIcon name="settings" className="mobile-tab-icon" />
        <span>Ajustes</span>
      </NavLink>
    </nav>
  )
}
