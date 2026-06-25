import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { sidebarLinks } from '../lib/navigation'
import { usuarioPodeAcessar } from '../lib/permissions'

type SidebarProps = {
  open: boolean
  onClose: () => void
  onAvisos?: () => void
}

export function Sidebar({ open, onClose, onAvisos }: SidebarProps) {
  const { user } = useAuth()
  const links = sidebarLinks.filter((item) => usuarioPodeAcessar(user, item.access))

  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'visible' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Links operacionais">
        <div className="sidebar-header">
          <h2>Links Operacionais</h2>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Fechar menu">
            ×
          </button>
        </div>

        <nav className="sidebar-nav">
          {links.map((item) => {
            if (item.action === 'avisos') {
              return (
                <button
                  key={item.id}
                  type="button"
                  className="sidebar-link"
                  onClick={() => {
                    onAvisos?.()
                    onClose()
                  }}
                >
                  {item.label}
                </button>
              )
            }

            if (item.external) {
              return (
                <a
                  key={item.id}
                  className="sidebar-link"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={onClose}
                >
                  {item.label}
                </a>
              )
            }

            return (
              <NavLink
                key={item.id}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                to={item.href}
                onClick={onClose}
              >
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
