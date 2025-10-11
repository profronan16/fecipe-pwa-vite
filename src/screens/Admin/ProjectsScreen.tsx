// src/screens/Admin/ProjectsScreen.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Card, CardContent, CardActions,
  Button, TextField, MenuItem, Grid, Chip,
  LinearProgress, Alert, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@services/firebase'

// ===== Domínio (listas coerentes com o restante do app) =====
const CATEGORIAS = ['IFTECH', 'Feira de Ciências', 'Comunicação Oral', 'Banner'] as const
type Categoria = typeof CATEGORIAS[number] | ''

const SUBCATEGORIAS = ['Ensino', 'Extensão', 'Pesquisa/Inovação'] as const
type Subcategoria = typeof SUBCATEGORIAS[number] | ''

const TIPOS_FEIRA   = ['Fundamental', 'Ensino Médio', 'Superior'] as const
const TIPOS_COMORAL = ['Ensino Médio', 'Superior', 'Pós-graduação'] as const
const TIPOS_BANNER  = ['Ensino Médio', 'Superior'] as const
type Tipo = '' | 'Fundamental' | 'Ensino Médio' | 'Superior' | 'Pós-graduação'

// ===== Helpers =====
const stripNbsp = (s: string) => (s || '').replace(/\u00A0/g, ' ')
const clean = (s: any) => stripNbsp(String(s ?? '')).replace(/\s+/g, ' ').trim()
const normalize = (s: string) =>
  clean(s)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function optionsTipoFor(categoria: Categoria): readonly string[] {
  if (categoria === 'Feira de Ciências') return TIPOS_FEIRA
  if (categoria === 'Comunicação Oral') return TIPOS_COMORAL
  if (categoria === 'Banner') return TIPOS_BANNER
  return []
}

type Project = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
  apresentador?: string
  autores?: string[]
  assignedEvaluators?: string[]
  updatedAt?: any
}

// ===== Página =====
export default function ProjectsScreen() {
  const nav = useNavigate()

  // dados
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])

  // filtros
  const [qTitle, setQTitle] = useState('')
  const [fCategoria, setFCategoria] = useState<Categoria>('')
  const [fSub, setFSub] = useState<Subcategoria>('')
  const [fTipo, setFTipo] = useState<Tipo>('')

  // UI excluir
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  const tipoOptions = useMemo(() => optionsTipoFor(fCategoria), [fCategoria])

  // carregar projetos
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true); setError(null)
        // ordena por updatedAt desc se existir; se não, remove orderBy
        const qRef = query(collection(db, 'trabalhos'))
        const snap = await getDocs(qRef)
        const list: Project[] = snap.docs.map(d => {
          const data = d.data() as any
          return {
            id: d.id,
            titulo: clean(data.titulo),
            categoria: clean(data.categoria),
            subcategoria: clean(data.subcategoria),
            tipo: clean(data.tipo),
            area: clean(data.area),
            apresentador: clean(data.apresentador),
            autores: Array.isArray(data.autores) ? data.autores : [],
            assignedEvaluators: Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : ['ALL'],
            updatedAt: data.updatedAt || null,
          }
        })
        // ordena localmente por updatedAt desc, fallback título
        list.sort((a, b) => {
          const A = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0)
          const B = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0)
          if (B !== A) return B - A
          return (a.titulo || '').localeCompare(b.titulo || '')
        })

        if (!alive) return
        setProjects(list)
      } catch (e:any) {
        if (alive) setError(e?.message || 'Erro ao carregar projetos')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // aplicar filtros
  const filtered = useMemo(() => {
    const q = normalize(qTitle)
    const ct = clean(fCategoria)
    const sb = clean(fSub)
    const tp = clean(fTipo)

    return projects.filter(p => {
      if (q && !normalize(p.titulo || '').includes(q)) return false
      if (ct && clean(p.categoria || '') !== ct) return false
      if (sb && clean(p.subcategoria || '') !== sb) return false
      if (tp && clean(p.tipo || '') !== tp) return false
      return true
    })
  }, [projects, qTitle, fCategoria, fSub, fTipo])

  // ações
  const handleNew = () => nav('/admin/projects/new')
  const handleEdit = (id: string) => nav(`/admin/projects/edit/${id}`)

  const handleDelete = async () => {
    if (!confirmId) return
    try {
      await deleteDoc(doc(db, 'trabalhos', confirmId))
      setProjects(prev => prev.filter(p => p.id !== confirmId))
      setFeedback({ type: 'success', text: 'Projeto excluído com sucesso.' })
    } catch (e:any) {
      setFeedback({ type: 'error', text: e?.message || 'Falha ao excluir o projeto.' })
    } finally {
      setConfirmId(null)
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} mb={2}>
        <Typography variant="h5" fontWeight={800}>Projetos</Typography>
        <Stack direction="row" gap={1}>
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleNew}>
            Novo Projeto
          </Button>
        </Stack>
      </Stack>

      {/* Filtros */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', lg: 'row' }} gap={2}>
            <TextField
              label="Buscar por título"
              value={qTitle}
              onChange={(e)=>setQTitle(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              select
              label="Categoria"
              value={fCategoria}
              onChange={(e) => { setFCategoria(e.target.value as Categoria); setFSub(''); setFTipo('') }}
              size="small"
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Todas</MenuItem>
              {CATEGORIAS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>

            {(fCategoria === 'Comunicação Oral' || fCategoria === 'Banner') && (
              <TextField
                select
                label="Subcategoria"
                value={fSub}
                onChange={(e)=>setFSub(e.target.value as Subcategoria)}
                size="small"
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Todas</MenuItem>
                {SUBCATEGORIAS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            )}

            {(fCategoria === 'Feira de Ciências' || fCategoria === 'Comunicação Oral' || fCategoria === 'Banner') && (
              <TextField
                select
                label="Tipo"
                value={fTipo}
                onChange={(e)=>setFTipo(e.target.value as Tipo)}
                size="small"
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">Todos</MenuItem>
                {tipoOptions.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            )}
          </Stack>
        </CardContent>
      </Card>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {feedback && <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.text}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <Alert severity="info">Nenhum projeto encontrado com os filtros atuais.</Alert>
      )}

      <Grid container spacing={2}>
        {filtered.map(p => {
          const isAll = (p.assignedEvaluators?.length === 1 && p.assignedEvaluators[0] === 'ALL') || !p.assignedEvaluators?.length
          const visLabel = isAll ? 'Todos os avaliadores' : (p.assignedEvaluators || []).join('; ')
          return (
            <Grid item xs={12} md={6} lg={4} key={p.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                      {p.titulo || 'Sem título'}
                    </Typography>

                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {p.categoria && <Chip size="small" label={p.categoria} />}
                      {p.subcategoria && <Chip size="small" label={p.subcategoria} />}
                      {p.tipo && <Chip size="small" label={p.tipo} />}
                      {p.area && <Chip size="small" label={p.area} />}
                    </Stack>

                    {p.apresentador && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Apresentador(a):</strong> {p.apresentador}
                      </Typography>
                    )}

                    {!!p.autores?.length && (
                      <Typography variant="body2" color="text.secondary">
                        <strong>Autores:</strong> {p.autores.join('; ')}
                      </Typography>
                    )}

                    <Stack direction="row" alignItems="center" gap={1} mt={0.5}>
                      <VisibilityIcon fontSize="small" />
                      <Typography variant="caption" color="text.secondary">
                        {visLabel}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Stack direction="row" gap={1}>
                    <Tooltip title="Editar">
                      <IconButton onClick={() => handleEdit(p.id)}><EditIcon /></IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton color="error" onClick={() => setConfirmId(p.id)}><DeleteIcon /></IconButton>
                    </Tooltip>
                  </Stack>
                  <Button size="small" onClick={() => handleEdit(p.id)}>Abrir</Button>
                </CardActions>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Diálogo de confirmação */}
      <Dialog open={!!confirmId} onClose={() => setConfirmId(null)}>
        <DialogTitle>Excluir projeto</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Excluir</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
