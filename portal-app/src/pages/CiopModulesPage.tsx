import { createElement as h, Fragment } from 'react'
import { useAuth } from '../hooks/useAuth'
import { PortalCardItem } from '../components/PortalCard'
import { ModuleIcon } from '../lib/mobile-icons'
import { Link } from 'react-router-dom'
import { portalCards, cardRoute, type PortalCard as PortalCardType } from '../lib/navigation'
import { usuarioPodeAcessar } from '../lib/permissions'
import { isNativeApp } from '../lib/portal-origin'

function ModuleTile({ card }: { card: PortalCardType }) {
  const route = cardRoute(card)
  const inner = h(
    Fragment,
    null,
    h('span', { className: `mobile-module-icon theme-${card.theme}` }, h(ModuleIcon, { id: card.id })),
    h('span', { className: 'mobile-module-label' }, card.title),
    )
  if (route) {
    return h(Link, { to: route, className: 'mobile-module-tile' }, inner)
  }
  return h(
    'a',
    { href: card.href, className: 'mobile-module-tile', target: '_blank', rel: 'noreferrer' },
    inner,
    )
}

export function CiopModulesPage() {
  const { user } = useAuth()
  const native = isNativeApp()
  const ciop = portalCards.filter((c) => c.section === 'operacao' && usuarioPodeAcessar(user, c.access))

if (native) {
  return h(
    'div',
    { className: 'mobile-modules-page' },
    h(
      'header',
      { className: 'mobile-modules-hero mobile-inicio-hero' },
      h(
        'div',
        { className: 'mobile-inicio-head' },
        h(
          'div',
          null,
          h('p', { className: 'mobile-modules-eyebrow' }, 'Portal Operacional'),
          h('h1', null, 'CIOP'),
          ),
        ),
      h('p', { className: 'mobile-inicio-sub' }, 'Módulos operacionais CIOP/TCGL'),
      ),
    h(
      'div',
      { className: 'mobile-modules-grid' },
      ciop.map((card) => h(ModuleTile, { key: card.id, card })),
      ),
    )
}

return h(
  'div',
  { className: 'home-page' },
  h(
    'section',
    { className: 'cards-section' },
    h('h2', null, 'CIOP'),
    h(
      'div',
      { className: 'cards-grid' },
      ciop.map((card) => h(PortalCardItem, { key: card.id, card })),
      ),
    ),
  )
}
