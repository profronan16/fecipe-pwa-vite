// src/screens/Profile/ResetPasswordScreen.tsx
import { useState } from 'react'
import {
  Box, Card, CardContent, TextField,
  Typography, Button, Alert, Stack
} from '@mui/material'
import {
  getAuth, EmailAuthProvider,
  reauthenticateWithCredential, updatePassword
} from 'firebase/auth'

export default function ResetPasswordScreen(){
  const auth = getAuth()
  const user = auth.currentUser!
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{type:'success'|'error', text:string}|null>(null)

  const handleReset = async ()=>{
    if(!currentPw || !newPw || !confirmPw){
      setMsg({type:'error', text:'Preencha todos os campos'}); return
    }
    if(newPw !== confirmPw){
      setMsg({type:'error', text:'Nova senha e confirmação não coincidem'}); return
    }
    setLoading(true)
    try{
      const cred = EmailAuthProvider.credential(user.email!, currentPw)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, newPw)
      setMsg({type:'success', text:'Senha alterada com sucesso!'})
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }catch(e:any){
      setMsg({type:'error', text: e?.message || 'Erro ao redefinir senha'})
    }finally{
      setLoading(false)
    }
  }

  return (
    <Box p={2} maxWidth={520} mx="auto">
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>Redefinir Senha</Typography>
          {msg && <Alert severity={msg.type} sx={{ my: 1 }}>{msg.text}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField
              type="password" label="Senha atual"
              value={currentPw} onChange={e=>setCurrentPw(e.target.value)}
            />
            <TextField
              type="password" label="Nova senha"
              value={newPw} onChange={e=>setNewPw(e.target.value)}
            />
            <TextField
              type="password" label="Confirme a nova senha"
              value={confirmPw} onChange={e=>setConfirmPw(e.target.value)}
            />
            <Button
              variant="contained"
              onClick={handleReset}
              disabled={loading}
            >
              {loading ? 'Salvando…' : 'Salvar'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
