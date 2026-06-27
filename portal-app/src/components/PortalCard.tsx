import { Link } from 'react-router-dom'
import type { PortalCard } from '../lib/navigation'
import { cardRoute } from '../lib/navigation'
import { ModuleIcon } from '../lib/mobile-icons'
import { isNativeApp } from '../lib/portal-origin'

type PortalCardItemProps = {
  card: PortalCard
}

export function PortalCardItem({ card }: PortalCardItemProps) {
  const internalRoute = cardRoute(card)
  const native = isNativeApp()
  const content = (
    <>
      <div className="card-top">
        {native ? (
          <span className={`card-icon-wrap theme-${card.theme}`}>
            <ModuleIcon id={card.id} className="card-module-icon" />
          </span>
        ) : (
          <div className={`card-accent theme-${card.theme}`} aria-hidden="true" />
        )}
        <div>
          <h3>{card.title}</h3>
          <p>{card.description}</p>
        </div>
      </div>
      <span className="card-action">{card.action}</span>
    </>
  )

  if (internalRoute) {
    return (
      <Link to={internalRoute} className={`portal-card theme-${card.theme}`}>
        {content}
      </Link>
    )
  }

  return (
    <a
      href={card.href}
      className={`portal-card theme-${card.theme}`}
      target="_blank"
      rel="noreferrer"
    >
      {content}
    </a>
  )
}
