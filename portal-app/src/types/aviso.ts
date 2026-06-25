import type { Timestamp } from 'firebase/firestore'

export type PortalAviso = {
  id: string
  titulo: string
  mensagem: string
  publico: boolean
  perfis: string[]
  perfisRegra: string[]
  perfisBusca: string[]
  usuarios: string[]
  autorEmail: string
  autorNome: string
  inicioEm: Date | Timestamp | null
  fimEm: Date | Timestamp | null
  ativo: boolean
  criadoEm?: Date | Timestamp | null
  atualizadoEm?: Date | Timestamp | null
}

export type AvisoInput = {
  id?: string
  titulo: string
  mensagem: string
  publico: boolean
  perfis: string[]
  usuarios: string[]
  inicioEm: Date
  fimEm: Date
  autorEmail?: string
  autorNome?: string
}
