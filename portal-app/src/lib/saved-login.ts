import { isNativeApp } from './portal-origin'

const STORAGE_KEY = 'portal-app.saved-login.v1'

export type SavedLogin = {
  email: string
  senha: string
  remember: boolean
}

export function canSaveLoginLocally(): boolean {
  return isNativeApp()
}

export function loadSavedLogin(): SavedLogin | null {
  if (!canSaveLoginLocally()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<SavedLogin>
    if (!data.remember || !data.email || !data.senha) return null
    return {
      email: String(data.email),
      senha: String(data.senha),
      remember: true,
    }
  } catch {
    return null
  }
}

export function saveLoginLocally(email: string, senha: string): void {
  if (!canSaveLoginLocally()) return
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      email: email.trim(),
      senha,
      remember: true,
    } satisfies SavedLogin),
  )
}

export function clearSavedLogin(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
