import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import type { PortalUser } from '../types/user'
import { isAdministrador, normalizarPerfil } from './permissions'

function normalizarEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

export async function buscarUsuarioFirestore(email: string): Promise<PortalUser | null> {
  const id = normalizarEmail(email)
  if (!id) return null

  const snap = await getDoc(doc(db, 'usuarios', id))
  if (!snap.exists()) return null

  const data = snap.data()
  const perfil = String(data.perfil || 'Usuário')

  return {
    email: id,
    nome: String(data.nome || id),
    perfil,
    registro: String(data.registro ?? data.matricula ?? '').trim(),
    cargo: String(data.cargo ?? data.funcaoCargo ?? '').trim(),
    ativo: data.ativo !== false,
    isAdmin: normalizarPerfil(perfil) === 'administrador',
  }
}

export function mapFirebaseUser(
  email: string,
  cadastro: Partial<PortalUser> | null,
): PortalUser {
  const perfil = cadastro?.perfil || 'Usuário'
  return {
    email: normalizarEmail(email),
    nome: cadastro?.nome || email,
    perfil,
    registro: cadastro?.registro || '',
    cargo: cadastro?.cargo || '',
    ativo: cadastro?.ativo !== false,
    isAdmin: isAdministrador({ perfil }),
  }
}

export async function listarUsuariosFirestore(): Promise<PortalUser[]> {
  const snap = await getDocs(collection(db, 'usuarios'))
  const lista: PortalUser[] = []
  snap.forEach((item) => {
    const data = item.data()
    const perfil = String(data.perfil || 'Usuário')
    lista.push({
      email: item.id,
      nome: String(data.nome || item.id),
      perfil,
      registro: String(data.registro ?? data.matricula ?? '').trim(),
      cargo: String(data.cargo ?? data.funcaoCargo ?? '').trim(),
      ativo: data.ativo !== false,
      isAdmin: normalizarPerfil(perfil) === 'administrador',
    })
  })
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}
