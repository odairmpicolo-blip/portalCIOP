import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { buscarUsuarioFirestore, mapFirebaseUser } from '../lib/users'
import type { PortalUser } from '../types/user'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-types'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [user, setUser] = useState<PortalUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    void setPersistence(auth, browserSessionPersistence).catch((error) =>
      console.warn('Sessão Firebase:', error),
    )

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!active) return

      setFirebaseUser(fbUser)

      if (!fbUser?.email) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const cadastro = await buscarUsuarioFirestore(fbUser.email)
        const mapped = mapFirebaseUser(fbUser.email, cadastro)

        if (!mapped.ativo) {
          await signOut(auth)
          setUser(null)
          alert('Seu acesso ao portal está desativado. Procure um administrador.')
        } else {
          setUser(mapped)
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error)
        setUser(null)
      } finally {
        if (active) setLoading(false)
      }
    })

    return () => {
      active = false
      unsub()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      firebaseUser,
      loading,
      async login(email, senha) {
        await signInWithEmailAndPassword(auth, email.trim(), senha)
      },
      async logout() {
        await signOut(auth)
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim())
      },
    }),
    [user, firebaseUser, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
