import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

type Props = { allow: Array<'admin'|'evaluator'> }
export default function RoleGuard({ allow }: Props){
  const { role } = useAuth()
  if(!role) return <Navigate to="/unauthorized" replace/>
  if(!allow.includes(role)) return <Navigate to="/unauthorized" replace/>
  return <Outlet/>
}
