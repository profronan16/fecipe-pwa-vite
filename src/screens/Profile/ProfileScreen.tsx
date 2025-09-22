import { useEffect, useState } from 'react'
import { Box, Card, CardContent, TextField, Typography, Button, LinearProgress, Alert, Stack } from '@mui/material'
import { useAuth } from '@contexts/AuthContext'
import { getProfile, updateProfileName } from '@services/firestore/profile'
import { useNavigate } from 'react-router-dom'

export default function ProfileScreen(){
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{type:'success'|'error', text:string}|null>(null)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      if(!user?.email) return
      setLoading(true)
      try{
        const data = await getProfile(user.email)
        if(alive && data) setName(data.name || '')
      }catch(e:any){
        setMsg({ type:'error', text: 'Erro ao carregar perfil' })
      }finally{
        if(alive) setLoading(false)
      }
    })()
    return ()=>{ alive=false }
  }, [user])

  const save = async ()=>{
    if(!user?.email) return
    if(!name.trim()){ setMsg({type:'error', text:'Nome não pode ficar em branco'}); return }
    setLoading(true)
    try{
      await updateProfileName(user.email, name.trim())
      setMsg({ type:'success', text:'Dados atualizados' })
    }catch(e:any){
      setMsg({ type:'error', text: 'Erro ao salvar' })
    }finally{ setLoading(false) }
  }

  return (
    <Box p={2}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>Meu Perfil</Typography>
          {loading && <LinearProgress/>}
          {msg && <Alert severity={msg.type} sx={{my:1}}>{msg.text}</Alert>}

          <Stack spacing={2} sx={{mt:1}}>
            <TextField label="Email (não editável)" value={user?.email || ''} disabled/>
            <TextField label="Nome" value={name} onChange={e=>setName(e.target.value)}/>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={save} disabled={loading}>Salvar Nome</Button>
              <Button variant="outlined" onClick={()=>nav('/evaluator/reset-password')} disabled={loading}>Redefinir Senha</Button>
              <Button color="error" onClick={logout}>Sair</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
