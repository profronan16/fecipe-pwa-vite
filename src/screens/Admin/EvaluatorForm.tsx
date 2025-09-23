// src/screens/Admin/EvaluatorForm.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, TextField, Button, Stack,
  Alert, LinearProgress, FormControl, InputLabel, Select, MenuItem,
  FormControlLabel, Switch, Chip, OutlinedInput
} from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '@services/firebase'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

type Role = 'evaluator' | 'admin'
type FormState = {
  name: string
  email: string
  role: Role
  active: boolean
  categorias: string[]
}

// mesmas categorias do ProjectForm para manter alinhado com os projetos
const CATEGORIES = [
  'Ensino',
  'Pesquisa/Inovação',
  'Extensão',
  'Comunicação Oral',
  'IFTECH',
  'Robótica',
]

export default function EvaluatorForm(){
  // quando editar, usamos :id = email do avaliador (docId na coleção users)
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const nav = useNavigate()

  const [loading, setLoading] = useState<boolean>(!!id)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{type:'success'|'error', text:string} | null>(null)

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    role: 'evaluator',
    active: true,
    categorias: [],
  })

  useEffect(()=>{
    let alive = true
    const load = async ()=>{
      if(!id) return
      try{
        const s = await getDoc(doc(db,'users', decodeURIComponent(id)))
        if (alive && s.exists()){
          const d = s.data() as any
          setForm({
            name: d.name || '',
            email: d.email || decodeURIComponent(id),
            role: (d.role || 'evaluator') as Role,
            active: d.active !== false,
            categorias: Array.isArray(d.categorias) ? d.categorias : [],
          })
        } else if (alive) {
          setMsg({ type:'error', text:'Avaliador não encontrado' })
        }
      }catch(e:any){
        setMsg({ type:'error', text: e?.message || 'Erro ao carregar avaliador' })
      }finally{
        if(alive) setLoading(false)
      }
    }
    load()
    return ()=>{ alive = false }
  }, [id])

  const valid = useMemo(()=>{
    return !!form.name.trim() && !!form.email.trim() && !!form.role
  }, [form])

  const handleChange = (key: keyof FormState) =>
    (e: any) => setForm(s => ({ ...s, [key]: e.target?.value }))

  const toggleActive = (_: any, v: boolean) =>
    setForm(s => ({ ...s, active: v }))

  const submit = async ()=>{
    if(!valid){
      setMsg({ type:'error', text:'Preencha nome, e-mail e role.' })
      return
    }
    setSaving(true); setMsg(null)
    try{
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        active: form.active,
        categorias: form.categorias,
        updatedAt: new Date(),
      }

      if(isEdit){
        await updateDoc(doc(db,'users', form.email), payload)
      }else{
        // cria/mescla usando o email como id do documento
        await setDoc(doc(db,'users', payload.email), {
          ...payload,
          createdAt: new Date(),
        }, { merge: true })
      }

      setMsg({ type:'success', text:'Avaliador salvo com sucesso.' })
      nav('/admin/evaluators')
    }catch(e:any){
      setMsg({ type:'error', text: e?.message || 'Erro ao salvar avaliador' })
    }finally{
      setSaving(false)
    }
  }

  return (
    <Box p={2} maxWidth={720} mx="auto">
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={2}>
        <Typography variant="h5" fontWeight={800}>
          {isEdit ? 'Editar Avaliador' : 'Novo Avaliador'}
        </Typography>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" onClick={()=>nav(-1)}>Cancelar</Button>
          <Button variant="contained" onClick={submit} disabled={!valid || saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }}/>}
      {msg && <Alert severity={msg.type} sx={{ mb:2 }}>{msg.text}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Nome"
              value={form.name}
              onChange={handleChange('name')}
              required
              fullWidth
            />
            <TextField
              label="E-mail (ID do documento em users)"
              value={form.email}
              onChange={handleChange('email')}
              required
              fullWidth
              type="email"
              InputProps={{ readOnly: isEdit }} // ao editar, não deixamos trocar o ID
              helperText={isEdit ? 'O e-mail é o ID do documento e não pode ser alterado.' : 'Ex.: avaliador@instituto.edu.br'}
            />

            <FormControl fullWidth>
              <InputLabel id="role-label">Função</InputLabel>
              <Select
                labelId="role-label"
                label="Função"
                value={form.role}
                onChange={handleChange('role')}
              >
                <MenuItem value="evaluator">Avaliador</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={<Switch checked={form.active} onChange={toggleActive} />}
              label={form.active ? 'Ativo' : 'Inativo'}
            />

            <FormControl fullWidth>
              <InputLabel id="cat-label">Categorias (opcional)</InputLabel>
              <Select
                multiple
                labelId="cat-label"
                input={<OutlinedInput label="Categorias (opcional)" />}
                value={form.categorias}
                onChange={handleChange('categorias')}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as string[]).map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Box>
                )}
              >
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
