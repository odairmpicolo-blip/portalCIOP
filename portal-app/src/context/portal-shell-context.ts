import { createContext, useContext } from 'react'

export type PortalShellContextValue = {
  noticeVersion: number
}

export const PortalShellContext = createContext<PortalShellContextValue | null>(null)

export function usePortalShell() {
  const ctx = useContext(PortalShellContext)
  if (!ctx) throw new Error('usePortalShell deve ser usado dentro de AppLayout')
  return ctx
}
