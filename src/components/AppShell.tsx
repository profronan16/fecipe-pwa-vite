// src/components/AppShell.tsx
import { Outlet } from 'react-router-dom'
import AppLayout from './AppLayout'

export default function AppShell() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
