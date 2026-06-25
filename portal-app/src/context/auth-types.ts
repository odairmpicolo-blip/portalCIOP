import type { User } from 'firebase/auth'
import type { PortalUser } from '../types/user'

export type AuthContextValue = {
  user: PortalUser | null
  firebaseUser: User | null
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}
