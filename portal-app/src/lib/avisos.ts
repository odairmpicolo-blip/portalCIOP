import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  type QuerySnapshot,
  type Timestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import type { AvisoInput, PortalAviso } from '../types/aviso'

const COLECAO_AVISOS = 'avisos'
const COLECAO_AVISOS_USUARIO = 'avisosPorUsuario'

function normalizarEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

function normalizarTextoAviso(valor: string): string {
  return String(valor || '').normalize('NFC').trim()
}

function normalizarListaAviso(valor?: string | string[]): string[] {
  if (Array.isArray(valor)) {
    return valor.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return String(valor || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizarPerfilAviso(perfil: string): string {
  return String(perfil || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function criarPerfisRegraAviso(perfis: string[]): string[] {
  const variantes = new Set<string>()
  normalizarListaAviso(perfis).forEach((perfil) => {
    const original = String(perfil || '').trim()
    const semAcento = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    ;[original, semAcento, original.toLowerCase(), semAcento.toLowerCase()].forEach((item) => {
      if (item) variantes.add(item)
    })
  })
  return [...variantes]
}

function normalizarDataAviso(valor: unknown): Date | null {
  if (!valor) return null
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor
  if (typeof valor === 'object' && valor !== null && 'toDate' in valor) {
    const data = (valor as Timestamp).toDate()
    return Number.isNaN(data.getTime()) ? null : data
  }
  if (typeof valor === 'object' && valor !== null && 'seconds' in valor) {
    return new Date((valor as { seconds: number }).seconds * 1000)
  }
  const data = new Date(valor as string | number)
  return Number.isNaN(data.getTime()) ? null : data
}

function millisAviso(valor: unknown): number | null {
  const data = normalizarDataAviso(valor)
  return data ? data.getTime() : null
}

function avisoEmExposicao(aviso: PortalAviso, agora = Date.now()): boolean {
  const inicio = millisAviso(aviso.inicioEm)
  const fim = millisAviso(aviso.fimEm)
  return (inicio === null || inicio <= agora) && (fim === null || fim >= agora)
}

function normalizarAviso(id: string, dados: Record<string, unknown> = {}): PortalAviso {
  const perfis = normalizarListaAviso(dados.perfis as string | string[] | undefined)
  const usuarios = normalizarListaAviso(dados.usuarios as string | string[] | undefined)
    .map(normalizarEmail)
    .filter(Boolean)

  return {
    id,
    titulo: normalizarTextoAviso(String(dados.titulo || '')),
    mensagem: normalizarTextoAviso(String(dados.mensagem || '')),
    publico: dados.publico === true,
    perfis,
    perfisRegra: normalizarListaAviso(
      (dados.perfisRegra as string | string[] | undefined) || criarPerfisRegraAviso(perfis),
    ),
    perfisBusca: normalizarListaAviso(
      (dados.perfisBusca as string | string[] | undefined) ||
        perfis.map(normalizarPerfilAviso),
    ),
    usuarios,
    autorEmail: normalizarEmail(String(dados.autorEmail || '')),
    autorNome: String(dados.autorNome || ''),
    inicioEm: (dados.inicioEm as PortalAviso['inicioEm']) || null,
    fimEm: (dados.fimEm as PortalAviso['fimEm']) || null,
    ativo: dados.ativo !== false,
    criadoEm: (dados.criadoEm as PortalAviso['criadoEm']) || null,
    atualizadoEm: (dados.atualizadoEm as PortalAviso['atualizadoEm']) || null,
  }
}

function avisoTimestamp(aviso: PortalAviso): number {
  const data = aviso.inicioEm || aviso.criadoEm || aviso.atualizadoEm
  if (data && typeof data === 'object' && 'toMillis' in data) {
    return (data as Timestamp).toMillis()
  }
  if (data && typeof data === 'object' && 'seconds' in data) {
    return (data as { seconds: number }).seconds * 1000
  }
  const parsed = normalizarDataAviso(data)
  return parsed ? parsed.getTime() : 0
}

function ordenarAvisos(lista: PortalAviso[], { somenteEmExposicao = false } = {}): PortalAviso[] {
  return lista
    .filter((aviso) => aviso.ativo !== false)
    .filter((aviso) => !somenteEmExposicao || avisoEmExposicao(aviso))
    .sort((a, b) => avisoTimestamp(b) - avisoTimestamp(a))
}

function adicionarAvisosDoSnap(destino: Map<string, PortalAviso>, snap: QuerySnapshot) {
  snap.forEach((item) => {
    destino.set(item.id, normalizarAviso(item.id, item.data()))
  })
}

async function sincronizarAvisosPorUsuario(lista: PortalAviso[]) {
  const tarefas: Promise<unknown>[] = []
  lista.forEach((aviso) => {
    aviso.usuarios.forEach((emailUsuario) => {
      const emailNormalizado = normalizarEmail(emailUsuario)
      if (!emailNormalizado) return
      tarefas.push(
        setDoc(
          doc(db, COLECAO_AVISOS_USUARIO, emailNormalizado, 'itens', aviso.id),
          aviso,
          { merge: true },
        ),
      )
    })
  })
  await Promise.allSettled(tarefas)
}

export async function listarAvisosFirestore({
  email = '',
  perfil = '',
  gestor = false,
}: {
  email?: string
  perfil?: string
  gestor?: boolean
} = {}): Promise<PortalAviso[]> {
  const avisos = new Map<string, PortalAviso>()
  const col = collection(db, COLECAO_AVISOS)

  if (gestor) {
    adicionarAvisosDoSnap(avisos, await getDocs(col))
    const listaGestor = ordenarAvisos([...avisos.values()])
    await sincronizarAvisosPorUsuario(listaGestor)
    return listaGestor
  }

  const emailUsuario = normalizarEmail(email)
  const perfilRegra = String(perfil || '').trim()
  const perfilBusca = normalizarPerfilAviso(perfil)
  const consultas = [getDocs(query(col, where('publico', '==', true)))]

  if (emailUsuario) {
    consultas.push(getDocs(collection(db, COLECAO_AVISOS_USUARIO, emailUsuario, 'itens')))
  }
  if (perfilBusca) {
    consultas.push(getDocs(query(col, where('perfisBusca', 'array-contains', perfilBusca))))
  }
  if (perfilRegra) {
    consultas.push(getDocs(query(col, where('perfisRegra', 'array-contains', perfilRegra))))
  }

  const resultados = await Promise.allSettled(consultas)
  resultados.forEach((resultado) => {
    if (resultado.status === 'fulfilled') adicionarAvisosDoSnap(avisos, resultado.value)
    if (resultado.status === 'rejected') {
      console.warn('Consulta de avisos indisponível:', resultado.reason)
    }
  })

  return ordenarAvisos([...avisos.values()], { somenteEmExposicao: true })
}

export async function salvarAvisoFirestore(aviso: AvisoInput): Promise<PortalAviso> {
  const titulo = normalizarTextoAviso(aviso.titulo)
  const mensagem = normalizarTextoAviso(aviso.mensagem)
  if (!titulo || !mensagem) throw new Error('Informe título e mensagem do aviso.')

  const inicioEm = normalizarDataAviso(aviso.inicioEm)
  const fimEm = normalizarDataAviso(aviso.fimEm)
  if (!inicioEm || !fimEm) throw new Error('Informe início e fim de exposição do aviso.')
  if (fimEm.getTime() <= inicioEm.getTime()) {
    throw new Error('O fim da exposição deve ser depois do início.')
  }

  const id = aviso.id || `aviso_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const perfis = normalizarListaAviso(aviso.perfis)
  const perfisRegra = criarPerfisRegraAviso(perfis)
  const usuarios = normalizarListaAviso(aviso.usuarios).map(normalizarEmail).filter(Boolean)

  const payload: Record<string, unknown> = {
    titulo,
    mensagem,
    publico: aviso.publico === true,
    perfis,
    perfisRegra,
    perfisBusca: perfis.map(normalizarPerfilAviso),
    usuarios,
    inicioEm,
    fimEm,
    autorEmail: normalizarEmail(aviso.autorEmail || ''),
    autorNome: aviso.autorNome || '',
    ativo: true,
    atualizadoEm: serverTimestamp(),
  }

  let usuariosAntigos: string[] = []
  if (aviso.id) {
    const snapAntigo = await getDoc(doc(db, COLECAO_AVISOS, id))
    if (snapAntigo.exists()) {
      usuariosAntigos = normalizarAviso(id, snapAntigo.data()).usuarios
    }
  } else {
    payload.criadoEm = serverTimestamp()
  }

  await setDoc(doc(db, COLECAO_AVISOS, id), payload, { merge: true })

  const usuariosAtuais = new Set(usuarios)
  await Promise.all([
    ...usuarios.map((emailUsuario) =>
      setDoc(
        doc(db, COLECAO_AVISOS_USUARIO, emailUsuario, 'itens', id),
        { id, ...payload },
        { merge: true },
      ),
    ),
    ...usuariosAntigos
      .filter((emailUsuario) => !usuariosAtuais.has(emailUsuario))
      .map((emailUsuario) =>
        deleteDoc(doc(db, COLECAO_AVISOS_USUARIO, emailUsuario, 'itens', id)),
      ),
  ])

  return normalizarAviso(id, { id, ...payload, inicioEm, fimEm })
}

export async function excluirAvisoFirestore(id: string): Promise<void> {
  const avisoId = String(id || '').trim()
  if (!avisoId) throw new Error('Aviso inválido.')

  const avisoRef = doc(db, COLECAO_AVISOS, avisoId)
  const snap = await getDoc(avisoRef)
  const usuarios = snap.exists() ? normalizarAviso(avisoId, snap.data()).usuarios : []

  await Promise.all([
    deleteDoc(avisoRef),
    ...usuarios.map((emailUsuario) =>
      deleteDoc(doc(db, COLECAO_AVISOS_USUARIO, emailUsuario, 'itens', avisoId)),
    ),
  ])
}

export function destinatariosAviso(aviso: PortalAviso): string {
  if (aviso.publico) return 'Todos'
  const partes: string[] = []
  if (aviso.perfis.length) partes.push(aviso.perfis.join(', '))
  if (aviso.usuarios.length) partes.push(`${aviso.usuarios.length} usuário(s)`)
  return partes.join(' · ') || 'Sem destinatário'
}

export function valorDateTimeLocal(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`
}

export function dataAvisoLocal(valor: PortalAviso['inicioEm']): Date | null {
  return normalizarDataAviso(valor)
}

export function periodoAvisoPadrao(): { inicio: Date; fim: Date } {
  const inicio = new Date()
  inicio.setMinutes(0, 0, 0)
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
  return { inicio, fim }
}
