// src/screens/Admin/EvaluatorsScreen.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, Button, TextField, Chip,
  Card, CardContent, CardActions, IconButton, Tooltip,
  LinearProgress, Alert, Switch, FormControlLabel
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { collection, deleteDoc, doc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useNavigate } from 'react-router-dom'

type Evaluator = {
  id: string            // usamos o email como id do doc
  name?: string
  email: string
  role: 'evaluator' | 'admin'
  active?: boolean
  categorias?: string[] // opcional: categorias habilitadas
}

export default function EvaluatorsScreen(){
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Evaluator[]>([])
  const [search, setSearch] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async ()=>{
    setLoading(true); setError(null)
    try{
      // Busca perfis com role evaluator (ou admin, se quiser ver todos)
      const q = query(collection(db,'users'), where('role','in',['evaluator','admin']))
      const snap = await getDocs(q)
      const list: Evaluator[] = snap.docs.map(d=>{
        const data = d.data() as any
        return {
          id: d.id,
          name: data.name || '',
          email: data.email || d.id,
          role: (data.role || 'evaluator') as any,
          active: data.active !== false,        // default true
          categorias: Array.isArray(data.categorias) ? data.categorias : undefined,
        }
      })
      setItems(list)
    }catch(e:any){
      setError(e?.message || 'Erro ao carregar avaliadores')
    }finally{
      setLoading(false)
    }
  },[])

  useEffect(()=>{ load() }, [load])

  const filtered = useMemo(()=>{
    const term = search.trim().toLowerCase()
    return items
      .filter(i => (onlyActive ? i.active !== false : true))
      .filter(i =>
        !term ||
        i.email.toLowerCase().includes(term) ||
        (i.name || '').toLowerCase().includes(term)
      )
      .sort((a,b)=> (a.name||a.email).localeCompare(b.name||b.email))
  }, [items, search, onlyActive])

  const toggleActive = async (it: Evaluator) => {
    setLoading(true)
    try{
      await updateDoc(doc(db,'users', it.id), { active: it.active === false ? true : false })
      await load()
    }catch(e:any){
      setError(e?.message || 'Erro ao atualizar status')
      setLoading(false)
    }
  }

  const handleDelete = async (it: Evaluator) => {
    if(!confirm(`Remover o cadastro de ${it.email}? (apenas o documento de perfil)`)) return
    setLoading(true)
    try{
      await deleteDoc(doc(db,'users', it.id))
      await load()
    }catch(e:any){
      setError(e?.message || 'Erro ao excluir')
      setLoading(false)
    }
  }

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} alignItems={{ xs:'stretch', sm:'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>👥 Avaliadores</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="contained" startIcon={<AddIcon/>} onClick={()=>nav('/admin/evaluators/new')}>
            Novo avaliador
          </Button>
          <Button variant="outlined" onClick={load}>Recarregar</Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs:'column', sm:'row' }} gap={2} mb={2} alignItems={{ xs:'stretch', sm:'center' }}>
        <TextField
          fullWidth
          placeholder="Buscar por nome ou email…"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
        />
        <FormControlLabel
          control={<Switch checked={onlyActive} onChange={(_,v)=>setOnlyActive(v)} />}
          label="Mostrar apenas ativos"
        />
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }}/>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      {!filtered.length ? (
        <Alert severity="info">Nenhum avaliador encontrado.</Alert>
      ) : (
        <Stack gap={2}>
          {filtered.map(it=>(
            <Card key={it.id} variant="outlined">
              <CardContent>
                <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" gap={1}>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {it.name || '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {it.email} • Role: {it.role} • {it.active === false ? 'Inativo' : 'Ativo'}
                    </Typography>
                    {it.categorias?.length ? (
                      <Stack direction="row" gap={1} flexWrap="wrap" mt={1}>
                        {it.categorias.map(c=> <Chip key={c} size="small" label={c} />)}
                      </Stack>
                    ) : null}
                  </Box>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink:0 }}>
                    <Tooltip title={it.active === false ? 'Reativar' : 'Desativar'}>
                      <IconButton onClick={()=>toggleActive(it)}>
                        <Switch checked={it.active !== false} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Editar">
                      <IconButton color="primary" onClick={()=>nav(`/admin/evaluators/${encodeURIComponent(it.id)}/edit`)}>
                        <EditIcon/>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir (apenas perfil)">
                      <IconButton color="error" onClick={()=>handleDelete(it)}>
                        <DeleteIcon/>
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
              <CardActions sx={{ pt:0, justifyContent:'flex-end' }}>
                <Button size="small" onClick={()=>nav(`/admin/evaluators/${encodeURIComponent(it.id)}/edit`)}>
                  Abrir no formulário
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
