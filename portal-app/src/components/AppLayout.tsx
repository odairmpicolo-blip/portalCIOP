import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { MobileTabBar } from './MobileTabBar'
import { NoticeModal } from './NoticeModal'
import { Sidebar } from './Sidebar'
import { PortalShellContext } from '../context/portal-shell-context'
import { isNativeApp } from '../lib/portal-origin'
import { usuarioPodeEnviarAviso } from '../lib/permissions'
import { useAuth } from '../hooks/useAuth'

export function AppLayout() {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [noticeModalOpen, setNoticeModalOpen] = useState(false)
  const [noticeVersion, setNoticeVersion] = useState(0)
  const [noticeModalKey, setNoticeModalKey] = useState(0)
  const [native, setNative] = useState(false)

  useEffect(() => {
    setNative(isNativeApp())
  }, [])

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

  return (
    <PortalShellContext.Provider value={{ noticeVersion }}>
      <div className={`app-shell${native ? ' app-shell--native' : ''}`}>
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onAvisos={podeAvisos ? abrirAvisos : undefined}
        />
        <div className="app-main">
          <Header onMenuToggle={() => setSidebarOpen(true)} native={native} />
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
            <MobileTabBar onMenuOpen={() => setSidebarOpen(true)} onAvisos={podeAvisos ? abrirAvisos : undefined} />
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
