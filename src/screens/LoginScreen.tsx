// src/screens/Auth/LoginScreen.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Container, Card, CardContent, Stack, Typography,
  TextField, Button, Alert, Link, Box
} from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@contexts/AuthContext'

export default function LoginScreen() {
  const { user, loginWithPassword, authError, clearAuthError } = useAuth()
  const nav = useNavigate()
  const location = useLocation() as { state?: { from?: string } }
  const from = useMemo(() => location?.state?.from || '/', [location])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) nav(from, { replace: true })
  }, [user, from, nav])

  useEffect(() => clearAuthError?.(), []) // limpa mensagens ao entrar

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await loginWithPassword(email.trim(), password)
      // redirecionamento acontece no useEffect ao mudar user
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <Card sx={{ width: '100%', boxShadow: 6, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={3} alignItems="stretch">
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={800}>FECIPE — Avaliação</Typography>
              <Typography variant="body2" color="text.secondary">Entre com seu e-mail e senha</Typography>
            </Box>

            {authError && <Alert severity="error">{authError}</Alert>}

            <Stack component="form" onSubmit={onSubmit} spacing={2}>
              <TextField
                type="email" label="E-mail" value={email}
                onChange={(e) => setEmail(e.target.value)} required fullWidth
              />
              <TextField
                type="password" label="Senha" value={password}
                onChange={(e) => setPassword(e.target.value)} required fullWidth
              />
              <Button type="submit" variant="contained" size="large" disabled={submitting}>
                Entrar
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary" textAlign="center">
              Precisa de acesso? Contate o administrador.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  )
}
