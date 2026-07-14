import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { MobileTabBar } from './MobileTabBar'
import { NoticeModal } from './NoticeModal'
import { Sidebar } from './Sidebar'
import { PortalShellContext } from '../context/portal-shell-context'
import { useNativeApp } from '../hooks/useNativeApp'
import { usuarioPodeEnviarAviso } from '../lib/permissions'
import { useAuth } from '../hooks/useAuth'

export function AppLayout() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [noticeModalOpen, setNoticeModalOpen] = useState(false)
  const [noticeVersion, setNoticeVersion] = useState(0)
  const [noticeModalKey, setNoticeModalKey] = useState(0)
  const native = useNativeApp()

  const podeAvisos = usuarioPodeEnviarAviso(user)

  function abrirAvisos() {
    if (!podeAvisos) return
    setNoticeModalKey((k) => k + 1)
    setNoticeModalOpen(true)
    document.body.classList.add('modal-open')
  }

  function fecharAvisos() {
    setNoticeModalOpen(false)
    document.body.classList.remove('modal-open')
  }

  function toggleSidebar() {
    setSidebarOpen((open) => !open)
  }

  const inHorarios = pathname.includes('onibus-horarios')
  const inOnibus = pathname.includes('onibus-agora') && !inHorarios
  const inAjustes = pathname === '/ajustes'
  const tracking = inOnibus || inHorarios
  const inHome = pathname === '/' || pathname === '/modulos' || pathname === '/ciop'
  const nativeShell = native || tracking

  return (
    <PortalShellContext.Provider value={{ noticeVersion }}>
      <div className={`app-shell${nativeShell ? ' app-shell--native' : ''}`}>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onAvisos={podeAvisos ? abrirAvisos : undefined}
        />
        <div
          className={`app-main${tracking ? ' app-main--tracking' : ''}${native && (inHome || inAjustes) ? ' app-main--home' : ''}`}
        >
          {tracking ? null : <Header onMenuToggle={toggleSidebar} native={native} home={native && (inHome || inAjustes)} />}
          <main className="app-content">
            <Outlet />
          </main>
          {!native ? (
            <footer className="app-footer portal-site-footer">
              <div className="footer-inner">
                <span className="footer-text">© 2026 CIOP - Todos os direitos reservados</span>
              </div>
            </footer>
          ) : null}
          {native ? (
            <MobileTabBar sidebarOpen={sidebarOpen} onMenuToggle={toggleSidebar} />
          ) : null}
        </div>
        {podeAvisos ? (
          <NoticeModal
            key={noticeModalKey}
            open={noticeModalOpen}
            onClose={fecharAvisos}
            onSaved={() => setNoticeVersion((v) => v + 1)}
          />
        ) : null}
      </div>
    </PortalShellContext.Provider>
  )
}
