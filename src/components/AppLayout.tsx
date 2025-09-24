// src/components/AppLayout.tsx
import { useState, PropsWithChildren, useMemo } from 'react'
import {
  AppBar, Toolbar, IconButton, Typography, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Divider, Avatar, Stack, useMediaQuery, Theme, Button
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import AssignmentIcon from '@mui/icons-material/Assignment'
import AssessmentIcon from '@mui/icons-material/Assessment'
import GroupIcon from '@mui/icons-material/Group'
import UploadIcon from '@mui/icons-material/CloudUpload'
import WorkIcon from '@mui/icons-material/Work'
import ListAltIcon from '@mui/icons-material/ListAlt'
import PersonIcon from '@mui/icons-material/Person'
import LogoutIcon from '@mui/icons-material/Logout'
import FolderIcon from '@mui/icons-material/Folder'
import { useNavigate, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

const DRAWER_WIDTH = 260

type MenuItem = { label: string; to: string; icon: JSX.Element }

export default function AppLayout({ children }: PropsWithChildren) {
  const { user, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mdUp = useMediaQuery((t: Theme) => t.breakpoints.up('md'))
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)
  const toggle = () => setOpen((v) => !v)

  const evaluatorItems: MenuItem[] = [
    { label: 'Dashboard', to: '/evaluator', icon: <DashboardIcon /> },
    { label: 'Trabalhos', to: '/evaluator/works', icon: <WorkIcon /> },
    { label: 'Minhas avaliações', to: '/evaluator/evaluations', icon: <ListAltIcon /> },
    { label: 'Perfil', to: '/evaluator/profile', icon: <PersonIcon /> },
  ]

  const adminItems: MenuItem[] = [
    { label: 'Dashboard', to: '/admin', icon: <DashboardIcon /> },
    { label: 'Projetos', to: '/admin/projects', icon: <FolderIcon /> },
    { label: 'Importação em lote', to: '/admin/projects/bulk', icon: <UploadIcon /> },
    { label: 'Avaliadores', to: '/admin/evaluators', icon: <GroupIcon /> },
    { label: 'Relatórios', to: '/admin/reports', icon: <AssessmentIcon /> },
  ]

  const items = role === 'admin' ? adminItems : evaluatorItems

  const title = useMemo(() => {
    // título simples baseado na rota atual
    const map: Record<string,string> = {
      '/admin': 'Admin',
      '/admin/projects': 'Projetos',
      '/admin/projects/bulk': 'Importação em lote',
      '/admin/evaluators': 'Avaliadores',
      '/admin/reports': 'Relatórios',
      '/evaluator': 'Avaliador',
      '/evaluator/works': 'Trabalhos',
      '/evaluator/evaluations': 'Minhas avaliações',
      '/evaluator/profile': 'Perfil',
    }
    const match = Object.keys(map).find(k => location.pathname.startsWith(k))
    return map[match || ''] || 'FECIPE — Avaliação'
  }, [location.pathname])

  const DrawerContent = (
    <Box role="presentation" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ p: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main' }}>
          {(user?.displayName || user?.email || 'U').slice(0,1).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap fontWeight={700}>
            {user?.displayName || user?.email}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {role === 'admin' ? 'Administrador' : 'Avaliador'}
          </Typography>
        </Box>
      </Stack>

      <Divider />

      <List sx={{ flex: 1, py: 1 }}>
        {items.map((it) => (
          <ListItemButton
            key={it.to}
            component={NavLink}
            to={it.to}
            onClick={close}
            sx={{
              '&.active': {
                bgcolor: 'action.selected',
                '& .MuiListItemIcon-root': { color: 'primary.main' },
              },
            }}
          >
            <ListItemIcon>{it.icon}</ListItemIcon>
            <ListItemText primary={it.label} />
          </ListItemButton>
        ))}
      </List>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<LogoutIcon />}
          onClick={async () => {
            await logout()
            close()
            navigate('/login', { replace: true })
          }}
        >
          Sair
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
      {/* AppBar */}
      <AppBar position="fixed" color="default" elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', zIndex: (t)=>t.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton edge="start" onClick={toggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={800} noWrap sx={{ flex: 1 }}>
            {title}
          </Typography>
          {/* Espaço para ações do topo (se quiser adicionar algo depois) */}
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      {mdUp ? (
        <Drawer
          variant="permanent"
          open
          sx={{
            width: DRAWER_WIDTH,
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {DrawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={open}
          onClose={close}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {DrawerContent}
        </Drawer>
      )}

      {/* Conteúdo */}
      <Box
        component="main"
        sx={{
          flex: 1,
          p: 2,
          mt: '64px', // altura do AppBar
          ...(mdUp && { ml: `${DRAWER_WIDTH}px` }),
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
