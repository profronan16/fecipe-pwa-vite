// src/screens/Work/WorkListScreen.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, TextField, ToggleButtonGroup, ToggleButton,
  FormControl, InputLabel, Select, MenuItem,
  Card, CardContent, CardActions, Button, Typography,
  LinearProgress, Alert, Stack, Checkbox, FormControlLabel, Chip
} from '@mui/material'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { listProjectsForEvaluator, Project } from '@services/firestore/projects'

const CATEGORIAS = ['IFTECH', 'Feira de Ciências', 'Comunicação Oral', 'Banner'] as const
type Categoria = typeof CATEGORIAS[number] | 'Todos'

const SUBCATEGORIAS = ['Ensino', 'Extensão', 'Pesquisa/Inovação'] as const
type Subcategoria = typeof SUBCATEGORIAS[number] | ''

// >>> Atualizado: inclui "Servidor" nas categorias corretas
const TIPOS_FEIRA = ['Fundamental', 'Ensino Médio', 'Superior'] as const
const TIPOS_COMORAL = ['Ensino Médio', 'Superior', 'Pós-graduação', 'Servidor'] as const
const TIPOS_BANNER = ['Ensino Médio', 'Superior', 'Servidor'] as const
type Tipo = '' | 'Fundamental' | 'Ensino Médio' | 'Superior' | 'Pós-graduação' | 'Servidor'

function optionsTipoFor(categoria: Categoria): readonly string[] {
  if (categoria === 'Feira de Ciências') return TIPOS_FEIRA
  if (categoria === 'Comunicação Oral') return TIPOS_COMORAL
  if (categoria === 'Banner') return TIPOS_BANNER
  return []
}

const normalize = (s: string) =>
  String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export default function WorkListScreen() {
  const { user, role } = useAuth()
  const nav = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [evaluatedIds, setEvaluatedIds] = useState<Set<string>>(new Set())
  const [hideEvaluated, setHideEvaluated] = useState(true)

  const [categories, setCategories] = useState<Categoria[]>(['Todos'])
  const [selectedCategory, setSelectedCategory] = useState<Categoria>('Todos')
  const [selectedSub, setSelectedSub] = useState<Subcategoria>('')
  const [selectedTipo, setSelectedTipo] = useState<Tipo>('')

  const [searchTerm, setSearchTerm] = useState('')
  const [mode, setMode] = useState<'titulo' | 'autor'>('titulo')

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    setError(null)
    try {
      const emailLower = user.email.toLowerCase()
      const data = await listProjectsForEvaluator(emailLower, role)
      setProjects(data)

      const evalSnap = await getDocs(
        query(collection(db, 'avaliacoes'), where('avaliadorId', '==', user.uid))
      )
      const done = new Set<string>(evalSnap.docs.map(d => (d.data() as any).trabalhoId))
      setEvaluatedIds(done)

      const cats = Array.from(
        new Set(
          data.map(p => (p.categoria && CATEGORIAS.includes(p.categoria as any) ? p.categoria : 'Sem categoria'))
        )
      ).sort() as Categoria[]
      setCategories(['Todos', ...cats])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar trabalhos')
    } finally {
      setLoading(false)
    }
  }, [user, role])

  useEffect(() => { load() }, [load])

  const tipoOptions = useMemo(() => optionsTipoFor(selectedCategory), [selectedCategory])

  const filtered = useMemo(() => {
    let list = [...projects]

    if (hideEvaluated) {
      list = list.filter(p => !evaluatedIds.has(p.id))
    }

    if (selectedCategory !== 'Todos') {
      list = list.filter(p => (p.categoria || '') === selectedCategory)
    }

    if ((selectedCategory === 'Comunicação Oral' || selectedCategory === 'Banner') && selectedSub) {
      list = list.filter(p => (p.subcategoria || '') === selectedSub)
    }

    if (
      (selectedCategory === 'Feira de Ciências' ||
        selectedCategory === 'Comunicação Oral' ||
        selectedCategory === 'Banner') &&
      selectedTipo
    ) {
      list = list.filter(p => (p.tipo || '') === selectedTipo)
    }

    if (searchTerm.trim()) {
      const t = normalize(searchTerm)
      list = list.filter(p =>
        mode === 'titulo'
          ? normalize(p.titulo || '').includes(t)
          : (Array.isArray(p.autores) ? p.autores : []).some(a => normalize(a).includes(t))
      )
    }

    return list
  }, [projects, evaluatedIds, hideEvaluated, selectedCategory, selectedSub, selectedTipo, searchTerm, mode])

  if (loading) return <LinearProgress />
  if (error) return <Alert severity="error">{error}</Alert>

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2} alignItems={{ xs: 'stretch', md: 'center' }}>
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
            onChange={e => {
              const v = e.target.value as Categoria
              setSelectedCategory(v)
              setSelectedSub('')
              setSelectedTipo('')
            }}
          >
            {categories.map(c => (<MenuItem key={c} value={c}>{c}</MenuItem>))}
          </Select>
        </FormControl>

        {(selectedCategory === 'Comunicação Oral' || selectedCategory === 'Banner') && (
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Subcategoria</InputLabel>
            <Select
              label="Subcategoria"
              value={selectedSub}
              onChange={e => setSelectedSub(e.target.value as Subcategoria)}
            >
              <MenuItem value="">Todas</MenuItem>
              {['Ensino', 'Extensão', 'Pesquisa/Inovação'].map(s => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
            </Select>
          </FormControl>
        )}

        {(selectedCategory === 'Feira de Ciências' || selectedCategory === 'Comunicação Oral' || selectedCategory === 'Banner') && (
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Tipo</InputLabel>
            <Select
              label="Tipo"
              value={selectedTipo}
              onChange={e => setSelectedTipo(e.target.value as Tipo)}
            >
              <MenuItem value="">Todos</MenuItem>
              {tipoOptions.map(t => (<MenuItem key={t} value={t}>{t}</MenuItem>))}
            </Select>
          </FormControl>
        )}
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
            const isAll = (item.assignedEvaluators?.length === 1 && item.assignedEvaluators[0] === 'ALL') || !item.assignedEvaluators?.length
            return (
              <Card key={item.id} variant="outlined" sx={{ opacity: already ? 0.7 : 1 }}>
                <CardContent>
                  <Stack spacing={0.75}>
                    <Typography variant="subtitle1" fontWeight={700}>{item.titulo || 'Sem título'}</Typography>

                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {item.categoria && <Chip size="small" label={item.categoria} />}
                      {item.subcategoria && <Chip size="small" label={item.subcategoria} />}
                      {item.tipo && <Chip size="small" label={item.tipo} />}
                      {item.area && <Chip size="small" label={item.area} />}
                    </Stack>

                    {item.apresentador && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Apresentador(a):</strong> {item.apresentador}
                      </Typography>
                    )}

                    {!!item.autores?.length && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Autores:</strong> {item.autores.join('; ')}
                      </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary">
                      {isAll ? 'Visível a todos os avaliadores' : 'Restrito a avaliadores vinculados'}
                    </Typography>
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={() =>
                      nav(`/evaluator/evaluate/${item.id}?titulo=${encodeURIComponent(item.titulo || '')}`)
                    }
                  >
                    {already ? 'Reabrir avaliação' : 'Avaliar'}
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
