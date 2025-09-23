// src/screens/Work/WorkListScreen.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, TextField, ToggleButtonGroup, ToggleButton,
  FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, CardActions, Button, Typography,
  LinearProgress, Alert, Stack
} from '@mui/material'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

type Trabalho = { id:string; titulo:string; alunos:string[]; categoria?:string; turma?:string }

export default function WorkListScreen(){
  const { user } = useAuth()
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const [allProjects, setAllProjects] = useState<Trabalho[]>([])
  const [categories, setCategories] = useState<string[]>(['Todos'])
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [mode, setMode] = useState<'titulo'|'autor'>('titulo')

  const loadData = useCallback(async ()=>{
    setLoading(true)
    try{
      // 1) buscar todos projetos
      const projSnap = await getDocs(collection(db,'trabalhos'))
      const projects:Trabalho[] = projSnap.docs.map(d=>{
        const data = d.data() as any
        return { id:d.id, titulo:data.titulo, alunos:Array.isArray(data.alunos)?data.alunos:[], categoria:data.categoria, turma:data.turma }
      })

      // 2) buscar IDs já avaliados por este avaliador
      const evalSnap = await getDocs(query(collection(db,'avaliacoes'), where('avaliadorId','==', user!.uid)))
      const done = new Set(evalSnap.docs.map(d=>(d.data() as any).trabalhoId))

      // 3) filtrar apenas não avaliados
      const available = projects.filter(p=>!done.has(p.id))

      // 4) categorias únicas
      const cats = Array.from(new Set(projects.map(p=>p.categoria || 'Sem categoria'))).sort()
      setCategories(['Todos', ...cats])

      setAllProjects(available)
    }finally{
      setLoading(false)
    }
  }, [user])

  useEffect(()=>{ if(user) loadData() }, [user, loadData])

  const filtered = useMemo(()=>{
    let list = allProjects
    if(selectedCategory!=='Todos'){
      list = list.filter(p => (p.categoria || 'Sem categoria') === selectedCategory)
    }
    if(searchTerm.trim()){
      const t = searchTerm.toLowerCase()
      list = list.filter(p =>
        mode==='titulo'
          ? p.titulo.toLowerCase().includes(t)
          : p.alunos.some(a=>a.toLowerCase().includes(t))
      )
    }
    return list
  }, [allProjects, selectedCategory, searchTerm, mode])

  if(loading) return <LinearProgress/>

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} mb={2}>
        <TextField
          fullWidth
          placeholder={mode==='titulo' ? 'Buscar por título...' : 'Buscar por autor...'}
          value={searchTerm}
          onChange={e=>setSearchTerm(e.target.value)}
        />
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={(_,v)=> v && setMode(v)}
        >
          <ToggleButton value="titulo">Título</ToggleButton>
          <ToggleButton value="autor">Autor</ToggleButton>
        </ToggleButtonGroup>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Categoria</InputLabel>
          <Select
            label="Categoria"
            value={selectedCategory}
            onChange={e=>setSelectedCategory(e.target.value)}
          >
            {categories.map(c=>(<MenuItem key={c} value={c}>{c}</MenuItem>))}
          </Select>
        </FormControl>
      </Stack>

      {!filtered.length ? (
        <Alert severity="info">Nenhum trabalho disponível</Alert>
      ) : (
        <Stack gap={2}>
          {filtered.map(item=>(
            <Card key={item.id} variant="outlined">
              <CardContent>
                <Typography variant="subtitle1">{item.titulo}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {(item.categoria||'—')} • {(item.turma||'—')}
                </Typography>
                <Typography variant="body2">Autores: {item.alunos.join(', ')}</Typography>
              </CardContent>
              <CardActions sx={{ justifyContent:'flex-end' }}>
                <Button
                  variant="contained"
                  onClick={()=>nav(`/evaluator/evaluate/${item.id}?titulo=${encodeURIComponent(item.titulo)}`)}
                >
                  Avaliar
                </Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}
