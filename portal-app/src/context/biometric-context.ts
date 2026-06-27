import { createContext, useContext } from 'react'

export type BiometricContextValue = {
  unlocked: boolean
  locking: boolean
  lock: () => void
  tryUnlock: () => Promise<boolean>
}

export const BiometricContext = createContext<BiometricContextValue | null>(null)

export function useBiometric(): BiometricContextValue {
  const ctx = useContext(BiometricContext)
  if (!ctx) throw new Error('useBiometric deve ser usado dentro de BiometricProvider')
  return ctx
}
