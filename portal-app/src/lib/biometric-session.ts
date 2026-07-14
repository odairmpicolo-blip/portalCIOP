/** Controle de biometria na sessão do app nativo.
 *
 *  Modelo simples: Face ID valida só no INÍCIO da sessão (primeiro
 *  acesso após login, ou primeira abertura do app com login já
 *  salvo). Depois de desbloqueado uma vez, fica desbloqueado — sem
 *  pedir de novo por causa de tempo ou de o app ter ido pro
 *  background — até o usuário sair da conta (logout), que é quando
 *  a sessão realmente termina. */
let unlocked = false

/** Persiste o desbloqueio ENTRE fechamentos completos do app: sem
 *  isso, o Face ID seria pedido de novo toda vez que o app fosse
 *  reaberto do zero, mesmo dentro da mesma sessão de login. */
const STORAGE_KEY = 'portal.biometricUnlocked'

let skipUnlockOnce = false

function persistUnlocked(value: boolean): void {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* localStorage indisponível (modo privado etc.) — segue só em memória */
  }
}

export function markBiometricSatisfied(): void {
  skipUnlockOnce = true
  markBiometricUnlocked()
}

export function markBiometricUnlocked(): void {
  unlocked = true
  persistUnlocked(true)
}

export function isBiometricSessionValid(): boolean {
  if (unlocked) return true
  try {
    unlocked = localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    unlocked = false
  }
  return unlocked
}

/** Chamado no logout — encerra a sessão de verdade, então o próximo
 *  login volta a pedir Face ID (é um novo "início de sessão"). */
export function clearBiometricSession(): void {
  unlocked = false
  persistUnlocked(false)
}

export function consumeBiometricSkip(): boolean {
  const skip = skipUnlockOnce
  skipUnlockOnce = false
  return skip
}
