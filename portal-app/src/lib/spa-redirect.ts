const STORAGE_KEY = 'portal-spa-redirect'

export function consumirRedirectSpa(): string | null {
  try {
    const destino = sessionStorage.getItem(STORAGE_KEY)
    if (!destino) return null
    sessionStorage.removeItem(STORAGE_KEY)
    return destino
  } catch {
    return null
  }
}
