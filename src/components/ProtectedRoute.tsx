// src/components/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

export default function ProtectedRoute() {
  const { user, loading, active } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  // se a conta estiver desativada, bloqueia tudo
  if (active === false) {
    return <Navigate to="/account-disabled" replace />
  }
  return <Outlet />
}
