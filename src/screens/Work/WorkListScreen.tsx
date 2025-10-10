// src/screens/Work/WorkListScreen.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, TextField, ToggleButtonGroup, ToggleButton,
  FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, CardActions, Button, Typography,
  LinearProgress, Alert, Stack, Checkbox, FormControlLabel
} from '@mui/material'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { listProjectsForEvaluator, Project } from '@services/firestore/projects'

export default function WorkListScreen() {
  const { user } = useAuth()
  const nav = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [evaluatedIds, setEvaluatedIds] = useState<Set<string>>(new Set())
  const [hideEvaluated, setHideEvaluated] = useState(true)

  // filtros
  const [categories, setCategories] = useState<string[]>(['Todos'])
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [mode, setMode] = useState<'titulo' | 'autor'>('titulo')

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    setError(null)
    try {
      // 1) Carrega projetos visíveis ao avaliador
      const emailLower = user.email.toLowerCase()
      const data = await listProjectsForEvaluator(emailLower)
      setProjects(data)

      // 2) Carrega avaliações já feitas por este avaliador (para marcar/ocultar)
      const evalSnap = await getDocs(
        query(collection(db, 'avaliacoes'), where('avaliadorId', '==', user.uid))
      )
      const done = new Set<string>(evalSnap.docs.map(d => (d.data() as any).trabalhoId))
      setEvaluatedIds(done)

      // 3) Gera lista de categorias (a partir dos projetos visíveis)
      const cats = Array.from(new Set(data.map(p => p.categoria || 'Sem categoria'))).sort()
      setCategories(['Todos', ...cats])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar trabalhos')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = projects

    if (hideEvaluated) {
      list = list.filter(p => !evaluatedIds.has(p.id))
    }

    if (selectedCategory !== 'Todos') {
      list = list.filter(p => (p.categoria || 'Sem categoria') === selectedCategory)
    }

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      list = list.filter(p =>
        mode === 'titulo'
          ? (p.titulo || '').toLowerCase().includes(t)
          : (Array.isArray(p.alunos) ? p.alunos : []).some(a => (a || '').toLowerCase().includes(t))
      )
    }

    return list
  }, [projects, evaluatedIds, hideEvaluated, selectedCategory, searchTerm, mode])

  if (loading) return <LinearProgress />
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <TextField
          fullWidth
          placeholder={mode === 'titulo' ? 'Buscar por título...' : 'Buscar por autor...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={(_, v) => v && setMode(v)}
        >
          <ToggleButton value="titulo">Título</ToggleButton>
          <ToggleButton value="autor">Autor</ToggleButton>
        </ToggleButtonGroup>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Categoria</InputLabel>
          <Select
            label="Categoria"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            {categories.map(c => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
          </Select>
        </FormControl>
      </Stack>

      <FormControlLabel
        control={<Checkbox checked={hideEvaluated} onChange={(e) => setHideEvaluated(e.target.checked)} />}
        label="Ocultar já avaliados"
        sx={{ mb: 2 }}
      />

      {!filtered.length ? (
        <Alert severity="info">Nenhum trabalho disponível para você.</Alert>
      ) : (
        <Stack gap={2}>
          {filtered.map(item => {
            const already = evaluatedIds.has(item.id)
            return (
              <Card key={item.id} variant="outlined" sx={{ opacity: already ? 0.7 : 1 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700}>{item.titulo}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(item.categoria || '—')} • {(item.turma || '—')}
                  </Typography>
                  {!!item.alunos?.length && (
                    <Typography variant="body2">Autores: {item.alunos.join(', ')}</Typography>
                  )}
                  {!item.assignedEvaluators || item.assignedEvaluators.includes('ALL') ? (
                    <Typography variant="caption" color="text.secondary">Visível a todos os avaliadores</Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">Restrito a avaliadores vinculados</Typography>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={() => nav(`/evaluator/evaluate/${item.id}?titulo=${encodeURIComponent(item.titulo || 'Projeto')}`)}
                  >
                    {already ? 'Rever Avaliação' : 'Avaliar'}
                  </Button>
                </CardActions>
              </Card>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
