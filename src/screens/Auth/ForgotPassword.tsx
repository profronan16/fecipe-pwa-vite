// src/screens/Auth/ForgotPassword.tsx
import { useState } from 'react'
import {
  Box, Card, CardContent, TextField,
  Button, Typography, Alert, Stack
} from '@mui/material'
import { getAuth, sendPasswordResetEmail } from 'firebase/auth'

export default function ForgotPassword(){
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{type:'success'|'error', text:string} | null>(null)

  const handleReset = async ()=>{
    if(!email.trim()){
      setMsg({ type:'error', text:'Digite seu email' })
      return
    }
    setLoading(true)
    try{
      await sendPasswordResetEmail(getAuth(), email.trim())
      setMsg({ type:'success', text:'Link de redefinição enviado ao seu email.' })
    }catch(e:any){
      setMsg({ type:'error', text: e?.message || 'Erro' })
    }finally{
      setLoading(false)
    }
  }

  return (
    <Box p={2} maxWidth={480} mx="auto">
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Esqueci minha senha</Typography>
          {msg && <Alert severity={msg.type} sx={{ mb: 2 }}>{msg.text}</Alert>}
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              autoComplete="email"
            />
            <Button variant="contained" disabled={loading} onClick={handleReset}>
              {loading ? 'Enviando…' : 'Enviar link de redefinição'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
