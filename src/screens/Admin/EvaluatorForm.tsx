import { useEffect, useMemo, useState } from 'react'
import { Box, Card, CardContent, TextField, Typography, Button, Alert, Stack } from '@mui/material'
import { createEvaluator, updateEvaluatorName, sendResetLink } from '@services/firestore/evaluator'
import { useNavigate, useParams } from 'react-router-dom'

export default function EvaluatorForm(){
  const nav = useNavigate()
  const { email } = useParams()
  const editing = useMemo(()=> !!email, [email])

  const [name, setName] = useState('')
  const [mail, setMail] = useState(decodeURIComponent(email || ''))
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{type:'success'|'error', text:string}|null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(()=>{ setMsg(null) },[])

  const save = async ()=>{
    setMsg(null)
    if(!name.trim()) { setMsg({type:'error', text:'Nome é obrigatório'}); return }
    if(!editing && !mail.trim()) { setMsg({type:'error', text:'Email é obrigatório'}); return }
    if(!editing && !password.trim()) { setMsg({type:'error', text:'Senha é obrigatória'}); return }
    setLoading(true)
    try{
      if(editing){
        await updateEvaluatorName(mail, name.trim())
        if(password.trim()){
          await sendResetLink(mail)
          setMsg({type:'success', text:'Avaliador atualizado. Link de senha enviado.'})
        }else{
          setMsg({type:'success', text:'Avaliador atualizado.'})
        }
      }else{
        await createEvaluator(name.trim(), mail.trim(), password.trim())
        setMsg({type:'success', text:'Avaliador criado.'})
      }
      setTimeout(()=>nav('/admin/evaluators'), 600)
    }catch(e:any){
      setMsg({type:'error', text:e?.message || 'Erro ao salvar'})
    }finally{ setLoading(false) }
  }

  return (
    <Box p={2}>
      <Card><CardContent>
        <Typography variant="h5" gutterBottom>{editing? 'Editar Avaliador' : 'Novo Avaliador'}</Typography>
        {msg && <Alert severity={msg.type} sx={{mb:2}}>{msg.text}</Alert>}
        <Stack spacing={2}>
          <TextField label="Nome" value={name} onChange={e=>setName(e.target.value)} />
          <TextField label="Email" value={mail} onChange={e=>setMail(e.target.value)} disabled={editing}/>
          {!editing && (
            <TextField label="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          )}
          <Button variant="contained" disabled={loading} onClick={save}>{editing? 'Atualizar':'Criar'}</Button>
        </Stack>
      </CardContent></Card>
    </Box>
  )
}
