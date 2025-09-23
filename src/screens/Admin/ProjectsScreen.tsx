// src/screens/Admin/ProjectsScreen.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, Button, TextField, Chip,
  Card, CardContent, CardActions, IconButton, Tooltip,
  LinearProgress, Alert
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useNavigate } from 'react-router-dom'

type Project = {
  id: string
  titulo: string
  alunos: string[]
  orientador?: string
  turma?: string
  anoSemestre?: string
  categoria: string
}

export default function ProjectsScreen(){
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>('Todos')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async ()=>{
    setLoading(true); setError(null)
    try{
      const snap = await getDocs(collection(db,'trabalhos'))
      const list = snap.docs.map(d => ({ id:d.id, ...(d.data() as any) })) as Project[]
      setProjects(list)
      setCategories(['Todos', ...Array.from(new Set(list.map(p=>p.categoria))).sort()])
    }catch(e:any){
      setError(e?.message || 'Erro ao carregar projetos')
    }finally{
      setLoading(false)
    }
  },[])

  useEffect(()=>{ load() }, [load])

  const filtered = useMemo(()=>{
    let list = projects
    if(filterCat !== 'Todos') list = list.filter(p=>p.categoria === filterCat)
    if(search.trim()){
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.titulo?.toLowerCase().includes(q) ||
        p.alunos?.some(a => a.toLowerCase().includes(q)) ||
        p.orientador?.toLowerCase().includes(q) ||
        p.turma?.toLowerCase().includes(q)
      )
    }
    return list
  }, [projects, filterCat, search])

  const handleDelete = async (id:string)=>{
    if(!confirm('Excluir este projeto? Esta ação não pode ser desfeita.')) return
    setLoading(true)
    try{
      await deleteDoc(doc(db,'trabalhos', id))
      await load()
    }catch(e:any){
      setError(e?.message || 'Erro ao excluir')
      setLoading(false)
    }
  }

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} alignItems={{ xs:'stretch', sm:'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>📁 Projetos</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="contained" startIcon={<AddIcon/>} onClick={()=>nav('/admin/projects/new')}>
            Novo Projeto
          </Button>
          <Button variant="outlined" onClick={load}>Recarregar</Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs:'column', sm:'row' }} gap={2} mb={2}>
        <TextField
          fullWidth
          placeholder="Buscar por título, autor, orientador ou turma…"
          value={search}
          onChange={(e)=>setSearch(e.target.value)}
        />
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          {categories.map(c=>(
            <Chip
              key={c}
              label={c}
              color={filterCat===c ? 'primary':'default'}
              onClick={()=>setFilterCat(c)}
            />
          ))}
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }}/>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      {!filtered.length ? (
        <Alert severity="info">Nenhum projeto encontrado.</Alert>
      ) : (
        <Stack gap={2}>
          {filtered.map(p=>(
            <Card key={p.id} variant="outlined">
              <CardContent>
                <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" gap={1}>
                  <Box flex={1} minWidth={0}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>{p.titulo}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      Categoria: {p.categoria} • Turma: {p.turma || '—'} • Orientador: {p.orientador || '—'}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: .5 }} noWrap>
                      Alunos: {Array.isArray(p.alunos) ? p.alunos.join('; ') : '—'}
                    </Typography>
                  </Box>
                  <Stack direction="row" alignItems="center" gap={1} sx={{ flexShrink:0 }}>
                    <Tooltip title="Editar">
                      <IconButton color="primary" onClick={()=>nav(`/admin/projects/${p.id}/edit`)}>
                        <EditIcon/>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton color="error" onClick={()=>handleDelete(p.id)}>
                        <DeleteIcon/>
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
              <CardActions sx={{ pt:0, justifyContent:'flex-end' }}>
                <Button size="small" onClick={()=>nav(`/admin/projects/${p.id}/edit`)}>
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
