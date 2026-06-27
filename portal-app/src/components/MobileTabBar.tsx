import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { TabIcon } from '../lib/mobile-icons'
import { onibusAgoraCard, onibusAgoraRoute, onibusHorariosCard, onibusHorariosRoute } from '../lib/navigation'
import { usuarioPodeAcessar } from '../lib/permissions'

type MobileTabBarProps = {
  onMenuOpen: () => void
  onAvisos?: () => void
}

export function MobileTabBar({ onMenuOpen, onAvisos }: MobileTabBarProps) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const inHorarios = pathname.includes('onibus-horarios')
  const inOnibus = pathname.includes('onibus-agora') && !inHorarios
  const inLegado = pathname.startsWith('/legado') && !inOnibus && !inHorarios
  const podeBus2 = onibusAgoraCard && usuarioPodeAcessar(user, onibusAgoraCard.access)
  const podeLinhas = podeBus2 && onibusAgoraRoute
  const podeHorarios = onibusHorariosCard && onibusHorariosRoute && usuarioPodeAcessar(user, onibusHorariosCard.access)

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
      {podeLinhas ? (
        <NavLink
          to={onibusAgoraRoute!}
          className={() => `mobile-tab${inOnibus ? ' active' : ''}`}
        >
          <TabIcon name="linhas" className="mobile-tab-icon" />
          <span>Linhas</span>
        </NavLink>
      ) : null}
      {podeHorarios ? (
        <NavLink
          to={onibusHorariosRoute!}
          className={() => `mobile-tab${inHorarios ? ' active' : ''}`}
        >
          <TabIcon name="horarios" className="mobile-tab-icon" />
          <span>Horários</span>
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
