import type { AccessRule } from './permissions'

export type CardTheme =
  | 'blue'
  | 'orange'
  | 'violet'
  | 'cyan'
  | 'slate'
  | 'rose'
  | 'teal'
  | 'green'
  | 'indigo'
  | 'amber'
  | 'red'
  | 'sky'

export type PortalCard = {
  id: string
  title: string
  description: string
  action: string
  theme: CardTheme
  href?: string
  legacyPath?: string
  external?: boolean
  access?: AccessRule
  section: 'operacao' | 'dashboards'
}

export type SidebarLink = {
  id: string
  label: string
  href: string
  external?: boolean
  access?: AccessRule
  action?: 'avisos'
}

const adminSupervisorAnalista: AccessRule = {
  perfis: ['Administrador', 'Supervisor', 'Analista'],
}

const adminSupervisorGerencia: AccessRule = {
  perfis: ['Administrador', 'Supervisor', 'Gerência', 'Gerencia'],
}

const adminSupervisorGerenciaAnalista: AccessRule = {
  perfis: ['Administrador', 'Supervisor', 'Gerência', 'Gerencia', 'Analista'],
}

const adminSupervisor: AccessRule = {
  perfis: ['Administrador', 'Supervisor'],
}

const adminSupervisorSecretaria: AccessRule = {
  perfis: ['Administrador', 'Supervisor', 'Gerência', 'Gerencia', 'Secretária', 'Secretaria'],
}

// Seção "dashboards" — aparece primeiro no app (posições 1-11 do layout combinado com o usuário).
// Seção "operacao" — aparece depois, com o rótulo "CIOP" no app nativo (posições 1-15),
// seguida do card de Liberação (dashboard) ao final da tela.
export const portalCards: PortalCard[] = [
  {
    id: 'pontualidade',
    title: 'IPV',
    description: 'Índice de Pontualidade das Viagens.',
    action: 'Acessar',
    theme: 'teal',
    legacyPath: '/pages/pontualidade.html',
    section: 'dashboards',
  },
  {
    id: 'icv',
    title: 'ICV',
    description: 'Índice de Cumprimento de Viagem.',
    action: 'Acessar',
    theme: 'sky',
    legacyPath: '/pages/icv.html',
    section: 'dashboards',
  },
  {
    id: 'autuacoes',
    title: 'Autuações',
    description: 'Consulta e indicadores de autuações.',
    action: 'Acessar',
    theme: 'amber',
    legacyPath: '/pages/autuacoes.html',
    access: adminSupervisorGerencia,
    section: 'dashboards',
  },
  {
    id: 'incidentes',
    title: 'Incidentes',
    description: 'Dashboard dos incidentes TCGL.',
    action: 'Acessar',
    theme: 'teal',
    legacyPath: '/pages/incidentes-dashboard.html',
    access: adminSupervisorGerenciaAnalista,
    section: 'dashboards',
  },
  {
    id: 'incidentes-analise',
    title: 'Dashboard de Incidentes',
    description: 'Análise detalhada e indicadores dos incidentes.',
    action: 'Acessar',
    theme: 'indigo',
    legacyPath: '/pages/incidentes-analise.html',
    access: adminSupervisorGerenciaAnalista,
    section: 'dashboards',
  },
  {
    id: 'dados-telemetria',
    title: 'Dados de telemetria',
    description: 'Comparativo de telemetria: TCGL, Clever e FleetBus.',
    action: 'Acessar',
    theme: 'teal',
    legacyPath: '/pages/dados-telemetria.html',
    access: { perfis: ['Administrador'] },
    section: 'dashboards',
  },
  {
    id: 'folha-dashboard',
    title: 'Dashboard de Serviço',
    description: 'Indicadores da planilha CIOP.',
    action: 'Acessar',
    theme: 'blue',
    legacyPath: '/pages/Folhadeservico.html',
    section: 'dashboards',
  },
  {
    id: 'km-dashboard',
    title: 'Comparação de KM',
    description: 'Comparativo mensal e diário TCGL, Clever e Noxxon.',
    action: 'Acessar',
    theme: 'sky',
    legacyPath: '/pages/comparacao-km.html',
    access: adminSupervisorGerencia,
    section: 'dashboards',
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Relatórios operacionais com exportação CSV, Excel e PDF.',
    action: 'Acessar',
    theme: 'slate',
    legacyPath: '/pages/relatorios.html',
    access: adminSupervisorAnalista,
    section: 'dashboards',
  },
  {
    id: 'terminais-agora',
    title: 'Terminais Agora',
    description: 'Presença de fiscais por terminal em tempo real.',
    action: 'Acessar',
    theme: 'violet',
    legacyPath: '/pages/terminais-agora.html',
    section: 'dashboards',
  },
  {
    id: 'onibus-agora',
    title: 'Ônibus Agora',
    description: 'Mapa ao vivo, busca por linha e veículo.',
    action: 'Abrir',
    theme: 'cyan',
    legacyPath: '/pages/onibus-agora.html',
    access: {
      usuarios: ['odair.marin@icloud.com'],
      somenteUsuarios: true,
    },
    section: 'dashboards',
  },
  {
    id: 'onibus-horarios',
    title: 'Horários Bus2',
    description: 'Partidas previstas por linha, local e via.',
    action: 'Consultar',
    theme: 'orange',
    legacyPath: '/pages/onibus-horarios.html',
    access: {
      usuarios: ['odair.marin@icloud.com'],
      somenteUsuarios: true,
    },
    section: 'dashboards',
  },
  {
    id: 'folha-lancamento',
    title: 'Lançamento de Serviço',
    description: 'Registrar informações na folha de serviço.',
    action: 'Lançar',
    theme: 'blue',
    legacyPath: '/pages/Folhadeservico1.html',
    access: adminSupervisorAnalista,
    section: 'operacao',
  },
  {
    id: 'liberacao-lancamento',
    title: 'Liberação',
    description: 'Acompanhamento da liberação.',
    action: 'Lançar',
    theme: 'orange',
    legacyPath: '/pages/liberacao-lancamento.html',
    access: adminSupervisorAnalista,
    section: 'operacao',
  },
  {
    id: 'criar-relatorio',
    title: 'Criar Relatório',
    description: 'Gerar relatório operacional com protocolo.',
    action: 'Acessar',
    theme: 'blue',
    legacyPath: '/pages/criar-relatorio.html',
    section: 'operacao',
  },
  {
    id: 'saida-carros',
    title: 'Saída de carros',
    description: 'Saída de carros da COT.',
    action: 'Acessar',
    theme: 'cyan',
    href: 'https://drive.google.com/drive/folders/140AXmLicGVvTm2Z5ALESVEmv0-K_mhYW',
    external: true,
    section: 'operacao',
  },
  {
    id: 'diarios-bordo',
    title: 'Diários de bordo',
    description: 'Diários de bordo.',
    action: 'Acessar',
    theme: 'slate',
    href: 'https://drive.google.com/drive/folders/1-jBeEFxHtTgvXbjkJbhonY-ijKg16UcF',
    external: true,
    section: 'operacao',
  },
  {
    id: 'desvios',
    title: 'Desvios',
    description: 'Acesso aos desvios criados.',
    action: 'Acessar',
    theme: 'rose',
    href: 'https://www.canva.com/design/DAGmHCnCGlc/hBDsSXTyhOo_FJjbAsIRMQ/edit',
    external: true,
    access: adminSupervisorAnalista,
    section: 'operacao',
  },
  {
    id: 'tabelas',
    title: 'Tabelas',
    description: 'Tabelas de planejamento.',
    action: 'Acessar',
    theme: 'teal',
    href: 'https://drive.google.com/drive/folders/1oq_QLjcIpZGqWD6zRcLtK4PIj5my6TtE',
    external: true,
    section: 'operacao',
  },
  {
    id: 'drive-monitoramento',
    title: 'Drive Monitoramento',
    description: 'Drive — Oficial Monitoramento.',
    action: 'Acessar',
    theme: 'green',
    href: 'https://drive.google.com/drive/folders/1m9ODnZuVVtFVUP1p_FUECy9E1xVBN1yd',
    external: true,
    access: adminSupervisorAnalista,
    section: 'operacao',
  },
  {
    id: 'horarios-fiscais',
    title: 'Horários para fiscais',
    description: 'Horários por terminal.',
    action: 'Acessar',
    theme: 'indigo',
    href: 'https://drive.google.com/drive/folders/111RpLw8iQI3Pypwi_sYdJ3NO1iG_Ow5K',
    external: true,
    access: adminSupervisorAnalista,
    section: 'operacao',
  },
  {
    id: 'canva',
    title: 'Canva',
    description: 'Acesso ao Canva — Início.',
    action: 'Acessar',
    theme: 'violet',
    href: 'https://www.canva.com/',
    external: true,
    access: adminSupervisorAnalista,
    section: 'operacao',
  },
  {
    id: 'cenario-atual',
    title: 'Cenário Atual',
    description: 'Acesso ao cenário atual — Divergências.',
    action: 'Acessar',
    theme: 'amber',
    href: 'https://www.canva.com/design/DAHDub_Za2k/oMlNaOEy98L0BTW1m1-Wuw/edit',
    external: true,
    access: adminSupervisorAnalista,
    section: 'operacao',
  },
  {
    id: 'pontos-controle',
    title: 'Pontos de controle',
    description: 'Localização dos pontos de controle.',
    action: 'Acessar',
    theme: 'red',
    href: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQcoPBPbjoZKmWb6KlDMMpwm0-AbzPA4PRziV6zS8U-VzXRKMtKEp_sbVf4cgHNEg/pubhtml#',
    external: true,
    section: 'operacao',
  },
  {
    id: 'planilha',
    title: 'Planilha',
    description: 'Acesso à planilha CIOP.',
    action: 'Acessar',
    theme: 'blue',
    href: 'https://docs.google.com/spreadsheets/d/1zY_BFsidZyF4RnzKTZkZAlmo-Qiz6JEdIEb3E2xoIeA/edit?gid=1013912232#gid=1013912232',
    external: true,
    access: adminSupervisor,
    section: 'operacao',
  },
  {
    id: 'gerenciar-patio',
    title: 'Gerenciar Pátio',
    description: 'Controle das filas para a saída dos carros.',
    action: 'Acessar',
    theme: 'sky',
    legacyPath: '/pages/gerenciapatio.html',
    access: {
      perfis: ['Administrador', 'Supervisor'],
      usuarios: ['pedroisrael2009@gmail.com'],
    },
    section: 'operacao',
  },
  {
    id: 'escala-saida-carros',
    title: 'Saída de carros',
    description:
      'Importa a planilha e cruza com o pátio — início entre 04:10 e 07:00, substituto quando pedido ou sem saída.',
    action: 'Acessar',
    theme: 'indigo',
    legacyPath: '/pages/escala-saida-carros.html',
    access: {
      perfis: ['Administrador', 'Supervisor'],
      usuarios: ['pedroisrael2009@gmail.com'],
    },
    section: 'operacao',
  },
  {
    id: 'liberacao-dashboard',
    title: 'Liberação',
    description: 'Acompanhamento da liberação.',
    action: 'Acessar',
    theme: 'orange',
    legacyPath: '/pages/liberacao-dashboard.html',
    section: 'operacao',
  },
]

export const sidebarLinks: SidebarLink[] = [
  {
    id: 'avisos',
    label: 'Adicionar Aviso',
    href: '/',
    action: 'avisos',
    access: adminSupervisorSecretaria,
  },
  { id: 'escala', label: 'Escala', href: 'http://intranet.grandelondrina.com.br:8080/escala/', external: true },
  {
    id: 'pedido-imagem',
    label: 'Pedido de Imagem',
    href: 'https://docs.google.com/forms/d/e/1FAIpQLScgGUDPuZdyN2KHVQfVWG0dORMmfOx06XEFYCEqwedqrPKwug/viewform',
    external: true,
  },
  {
    id: 'itinerarios',
    label: 'Itinerários',
    href: 'https://monitoramentotcgl.github.io/tajetos/index.html',
    external: true,
  },
  {
    id: 'incidentes-ext',
    label: 'Gerenciamento de Incidentes',
    href: 'https://cioplondrina.com.br/CADIncidentManagement/?ReturnUrl=%2fCADIncidentManagement%2fg%2f6ac2842af62b497aa5b0e515ef4b2ce9',
    external: true,
    access: adminSupervisorGerenciaAnalista,
  },
  {
    id: 'clever',
    label: 'Clever Reports',
    href: 'http://10.235.142.105:8888/Timeout.i4',
    external: true,
    access: adminSupervisorGerenciaAnalista,
  },
  { id: 'fleetbus', label: 'FleetBus', href: 'https://fleetbus.app/', external: true },
  { id: 'gsg', label: 'GSG Sistem', href: 'https://www.gsgsistem.com/tcgl/index.php', external: true },
  { id: 'globus', label: 'Globus', href: 'https://cmp.passaromarron.com.br', external: true },
  {
    id: 'mobilibus',
    label: 'Mobilibus',
    href: 'https://editor.mobilibus.com/web/home',
    external: true,
    access: adminSupervisorAnalista,
  },
  {
    id: 'usuarios',
    label: 'Gerenciar Usuários',
    href: '/legado/pages/admin-usuarios.html',
    access: adminSupervisorSecretaria,
  },
  {
    id: 'ponto',
    label: 'Ponto Eletrônico CIOP',
    href: 'http://192.168.0.243',
    external: true,
    access: { perfis: ['Administrador', 'Secretária', 'Secretaria'] },
  },
  {
    id: 'facial',
    label: 'Reconhecimento Facial',
    href: 'https://localhost:4445/#/home/monitoramento',
    external: true,
    access: { perfis: ['Administrador', 'Secretária', 'Secretaria'] },
  },
  {
    id: 'linea',
    label: 'Linea',
    href: 'https://dss.lineamidia.com.br/login?returnUrl=%2F',
    external: true,
    access: { perfis: ['Administrador', 'Secretária', 'Secretaria'] },
  },
]

export function legacyUrl(path: string): string {
  const origin = import.meta.env.VITE_LEGACY_ORIGIN || ''
  return `${origin}${path}`
}

export function cardTarget(card: PortalCard): string {
  if (card.external && card.href) return card.href
  if (card.legacyPath) return legacyUrl(card.legacyPath)
  return card.href || '/'
}

export function cardRoute(card: PortalCard): string | null {
  if (card.legacyPath) return `/legado${card.legacyPath}`
  return null
}

export const onibusAgoraCard = portalCards.find((c) => c.id === 'onibus-agora')

export const onibusAgoraRoute = onibusAgoraCard ? cardRoute(onibusAgoraCard) : null

export const onibusHorariosCard = portalCards.find((c) => c.id === 'onibus-horarios')

export const onibusHorariosRoute = onibusHorariosCard ? cardRoute(onibusHorariosCard) : null
