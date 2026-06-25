import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { paginaPermitida } from '../lib/permissions'
import type { AccessRule } from '../lib/permissions'
import { LoadingScreen } from './LoadingScreen'

type ProtectedRouteProps = {
  require?: AccessRule
}

export function ProtectedRoute({ require }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen label="Validando acesso" />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!paginaPermitida(user, require)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen label="Carregando" />
  if (user) return <Navigate to="/" replace />

  return <Outlet />
}
