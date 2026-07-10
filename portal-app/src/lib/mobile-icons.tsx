import type { ReactElement, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Svg({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

const icons: Record<string, (p: IconProps) => ReactElement> = {
  home: (p) => (
    <Svg {...p}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></Svg>
  ),
  grid: (p) => (
    <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>
  ),
  menu: (p) => (
    <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
  ),
  settings: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  ),
  bell: (p) => (
    <Svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 21a2 2 0 0 0 4 0" /></Svg>
  ),
  linhas: (p) => (
    <Svg {...p}><path d="M4 6h16v8H4z" /><path d="M6 18h2" /><path d="M16 18h2" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" /><path d="M4 10h16" /></Svg>
  ),
  onibus: (p) => (
    <Svg {...p}><path d="M4 6h16v8H4z" /><path d="M6 18h2" /><path d="M16 18h2" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" /><path d="M4 10h16" /></Svg>
  ),
  horarios: (p) => (
    <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
  ),
  'folha-lancamento': (p) => (
    <Svg {...p}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h6" /></Svg>
  ),
  'liberacao-lancamento': (p) => (
    <Svg {...p}><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>
  ),
  'terminais-agora': (p) => (
    <Svg {...p}><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></Svg>
  ),
  'onibus-agora': (p) => (
    <Svg {...p}><path d="M4 6h16v8H4z" /><path d="M6 18h2" /><path d="M16 18h2" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" /><path d="M4 10h16" /></Svg>
  ),
  'onibus-horarios': (p) => (
    <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
  ),
  'criar-relatorio': (p) => (
    <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Svg>
  ),
  'saida-carros': (p) => (
    <Svg {...p}><path d="M7 17h10M5 11h14l-1.5-4H6.5L5 11z" /><circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" /></Svg>
  ),
  'escala-saida-carros': (p) => (
    <Svg {...p}><path d="M4 6h16v12H4z" /><path d="M8 10h8" /><path d="M8 14h5" /><path d="M16 3v3" /><path d="M8 3v3" /></Svg>
  ),
  'diarios-bordo': (p) => (
    <Svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Svg>
  ),
  desvios: (p) => (
    <Svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></Svg>
  ),
  patio: (p) => (
    <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></Svg>
  ),
  pontualidade: (p) => (
    <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
  ),
  icv: (p) => (
    <Svg {...p}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-7" /></Svg>
  ),
  'dados-telemetria': (p) => (
    <Svg {...p}><path d="M4 6h16v12H4z" /><path d="M8 10h8" /><path d="M8 14h5" /><circle cx="17" cy="17" r="3" /></Svg>
  ),
  autuacoes: (p) => (
    <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M12 18v-6M9 15h6" /></Svg>
  ),
  incidentes: (p) => (
    <Svg {...p}><path d="M12 2 2 22h20L12 2z" /><path d="M12 10v4M12 18h.01" /></Svg>
  ),
  'liberacao-dashboard': (p) => (
    <Svg {...p}><path d="M4 19V5M4 19h16M8 16V9M12 16V6M16 16v-4" /></Svg>
  ),
  'km-dashboard': (p) => (
    <Svg {...p}><path d="M3 12h4l2-5 4 10 2-5h6" /></Svg>
  ),
  default: (p) => (
    <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h6v6H9z" /></Svg>
  ),
}

export function ModuleIcon({ id, ...props }: IconProps & { id: string }) {
  const Icon = icons[id] || icons.default
  return <Icon {...props} />
}

export function TabIcon({ name, ...props }: IconProps & { name: keyof typeof icons | string }) {
  const Icon = icons[name] || icons.default
  return <Icon {...props} />
}
