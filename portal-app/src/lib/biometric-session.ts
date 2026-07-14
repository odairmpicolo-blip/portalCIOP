/** Controle de biometria na sessão do app nativo. */
let skipUnlockOnce = false
let unlockedUntil = 0

/** Chave no localStorage — persiste o desbloqueio ENTRE fechamentos
 *  completos do app. Sem isso, `unlockedUntil` é só uma variável de
 *  memória: some toda vez que o app é fechado de verdade (não só
 *  minimizado), e o Face ID volta a ser pedido a cada reabertura,
 *  mesmo dentro da janela de sessão — o que na prática parece "pede
 *  toda hora" para quem fecha/abre o app com frequência. */
const STORAGE_KEY = 'portal.biometricUnlockedUntil'

/** Período sem pedir Face ID de novo após desbloqueio bem-sucedido.
 *  Antes eram 5 minutos — curto demais para uma sessão normal de uso
 *  (navegar entre várias páginas, preencher formulários, etc. já passa
 *  disso), fazendo o Face ID ser pedido de novo no meio do uso mesmo
 *  sem o app ter saído de primeiro plano. */
const SESSION_MS = 30 * 60 * 1000

/** Só exige biometria de novo após ficar em background por este tempo.
 *  Antes eram 45s — qualquer troca rápida de app (ver uma notificação,
 *  copiar algo, tirar print) já forçava novo Face ID ao voltar. */
export const BACKGROUND_LOCK_MS = 3 * 60 * 1000

function persistUnlockedUntil(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    /* localStorage indisponível (modo privado etc.) — segue só em memória */
  }
}

function readPersistedUnlockedUntil(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) || 0) || 0
  } catch {
    return 0
  }
}

export function markBiometricSatisfied(): void {
  skipUnlockOnce = true
  markBiometricUnlocked()
}

export function markBiometricUnlocked(): void {
  unlockedUntil = Date.now() + SESSION_MS
  persistUnlockedUntil(unlockedUntil)
}

export function isBiometricSessionValid(): boolean {
  if (Date.now() < unlockedUntil) return true
  // Sessão em memória expirou (ou é o primeiro carregamento depois de o
  // app ter sido fechado de verdade) — confere se ainda vale a pena
  // pelo valor salvo no último desbloqueio.
  const persisted = readPersistedUnlockedUntil()
  if (persisted && Date.now() < persisted) {
    unlockedUntil = persisted
    return true
  }
  return false
}

export function consumeBiometricSkip(): boolean {
  const skip = skipUnlockOnce
  skipUnlockOnce = false
  return skip
}
