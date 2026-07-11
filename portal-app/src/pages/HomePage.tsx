import { useAuth } from '../hooks/useAuth'
import { PortalCardItem } from '../components/PortalCard'
import { NoticeBoardContainer } from '../components/NoticeBoard'
import { portalCards } from '../lib/navigation'
import { usuarioPodeAcessar } from '../lib/permissions'
import { isNativeApp } from '../lib/portal-origin'

export function HomePage() {
  const { user } = useAuth()
  const native = isNativeApp()

  const dashboards = portalCards.filter(
    (card) => card.section === 'dashboards' && usuarioPodeAcessar(user, card.access),
  )

  return (
    <div className="home-page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Portal Operacional</p>
          <h1>Bem-vindo, {user?.nome?.split(' ')[0] || 'usuário'}</h1>
          <p className="hero-text">
            Acesso centralizado aos módulos CIOP/TCGL com perfil <strong>{user?.perfil}</strong>.
          </p>
        </div>
        {!native ? (
          <div className="hero-badge">
            <span>Novo portal</span>
            <small>React · Firebase · Apps Script</small>
          </div>
        ) : null}
      </section>

      <NoticeBoardContainer />

      <section className="cards-section">
        <h2>Dashboards</h2>
        <div className="cards-grid">
          {dashboards.map((card) => (
            <PortalCardItem key={card.id} card={card} />
          ))}
        </div>
      </section>
    </div>
  )
}
