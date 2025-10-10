// src/screens/Auth/AccountDisabled.tsx
import { Box, Button, Card, CardContent, Typography } from '@mui/material'
import BlockIcon from '@mui/icons-material/Block'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function AccountDisabled() {
  const { logout } = useAuth()
  const nav = useNavigate()

  return (
    <Box sx={{ minHeight: '70vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 560, width: '100%' }}>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <BlockIcon color="error" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h5" fontWeight={800} gutterBottom>
            Avaliador desativado
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Sua conta está desativada. Contate o administrador do sistema.
          </Typography>
          <Button
            variant="contained"
            onClick={async () => {
              await logout()
              nav('/login', { replace: true })
            }}
          >
            Sair e voltar ao login
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
