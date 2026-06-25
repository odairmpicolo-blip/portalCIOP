import type { PortalUser } from '../types/user'

export type AccessRule = {
  perfis?: string[]
  usuarios?: string[]
  excluirPerfis?: string[]
}

export function normalizarPerfil(perfil: string | undefined): string {
  return String(perfil || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function isAdministrador(user: Pick<PortalUser, 'perfil'> | null | undefined): boolean {
  return normalizarPerfil(user?.perfil) === 'administrador'
}

function listaPerfis(valores?: string[]): string[] {
  return (valores || []).map(normalizarPerfil).filter(Boolean)
}

function listaEmails(valores?: string[]): string[] {
  return (valores || []).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean)
}

export function usuarioPodeAcessar(
  user: PortalUser | null | undefined,
  rule?: AccessRule,
): boolean {
  if (!user) return false

  const perfil = normalizarPerfil(user.perfil)
  const email = String(user.email || '').toLowerCase()

  if (listaPerfis(rule?.excluirPerfis).includes(perfil)) return false
  if (isAdministrador(user)) return true

  const perfis = listaPerfis(rule?.perfis)
  const usuarios = listaEmails(rule?.usuarios)
  const temRegra = perfis.length > 0 || usuarios.length > 0

  if (!temRegra) return true
  return perfis.includes(perfil) || usuarios.includes(email)
}

export function paginaPermitida(
  user: PortalUser | null | undefined,
  require?: AccessRule,
): boolean {
  if (!user) return false
  if (isAdministrador(user)) return true
  if (!require?.perfis?.length && !require?.usuarios?.length) return true

  const perfil = normalizarPerfil(user.perfil)
  const email = String(user.email || '').toLowerCase()
  const perfis = listaPerfis(require.perfis)
  const usuarios = listaEmails(require.usuarios)

  return perfis.includes(perfil) || usuarios.includes(email)
}

export function usuarioPodeEnviarAviso(user: PortalUser | null | undefined): boolean {
  if (!user) return false
  if (isAdministrador(user)) return true
  const perfil = normalizarPerfil(user.perfil)
  return ['supervisor', 'gerencia', 'secretaria'].includes(perfil)
}
