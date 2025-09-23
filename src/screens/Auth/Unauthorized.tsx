// src/screens/Auth/Unauthorized.tsx
import { Box, Button, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function Unauthorized() {
  const nav = useNavigate()
  return (
    <Box
      p={4}
      minHeight="60vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
    >
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Acesso negado
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Você não tem permissão para acessar esta página.
      </Typography>
      <Button variant="outlined" onClick={() => nav(-1)}>
        Voltar
      </Button>
    </Box>
  )
}
