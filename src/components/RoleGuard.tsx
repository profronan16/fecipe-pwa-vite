// src/components/RoleGuard.tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

export default function RoleGuard({ allow }: { allow: Array<'admin'|'evaluator'> }) {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role === null) return null // aguarde resolver
  if (!allow.includes(role)) return <Navigate to="/unauthorized" replace />
  return <Outlet />
}
