// src/screens/Admin/EvaluatorsScreen.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, Button, Card, CardContent, CardActions,
  TextField, IconButton, Tooltip, LinearProgress, Alert, Chip, Grid,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { useNavigate } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, query } from 'firebase/firestore'
import { db } from '@services/firebase'

type UserRow = {
  id: string
  name?: string
  email?: string
  role?: 'evaluator' | 'admin'
  active?: boolean
  categorias?: string[]
  updatedAt?: any
}

const normalize = (s: any) =>
  String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export default function EvaluatorsScreen() {
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<UserRow[]>([])
  const [q, setQ] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const snap = await getDocs(query(collection(db, 'users')))
      const list: UserRow[] = snap.docs.map(d => {
        const u = d.data() as any
        return {
          id: d.id,
          name: u.name || '',
          email: u.email || d.id,
          role: (u.role || 'evaluator') as 'evaluator' | 'admin',
          active: u.active !== false,
          categorias: Array.isArray(u.categorias) ? u.categorias : [],
          updatedAt: u.updatedAt || null,
        }
      })
      // ordena por updatedAt desc, fallback nome
      list.sort((a, b) => {
        const A = a.updatedAt?.toMillis?.() ?? (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0)
        const B = b.updatedAt?.toMillis?.() ?? (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0)
        if (B !== A) return B - A
        return (a.name || '').localeCompare(b.name || '')
      })
      setRows(list)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar avaliadores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const term = normalize(q)
    if (!term) return rows
    return rows.filter(r =>
      normalize(r.name || '').includes(term) ||
      normalize(r.email || '').includes(term)
    )
  }, [rows, q])

  const handleNew = () => nav('/admin/evaluators/new')
  const handleEdit = (id: string) => nav(`/admin/evaluators/${encodeURIComponent(id)}/edit`)

  const handleDelete = async () => {
    if (!confirmId) return
    try {
      await deleteDoc(doc(db, 'users', confirmId))
      setRows(prev => prev.filter(r => r.id !== confirmId))
      setFeedback({ type: 'success', text: 'Avaliador removido com sucesso.' })
    } catch (e: any) {
      setFeedback({ type: 'error', text: e?.message || 'Falha ao remover avaliador.' })
    } finally {
      setConfirmId(null)
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} mb={2}>
        <Typography variant="h5" fontWeight={800}>Avaliadores</Typography>
        <Stack direction="row" gap={1}>
          <TextField
            size="small"
            placeholder="Buscar por nome ou e-mail…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <Button startIcon={<AddIcon />} variant="contained" onClick={handleNew}>Novo Avaliador</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {feedback && <Alert severity={feedback.type} sx={{ mb: 2 }}>{feedback.text}</Alert>}

      {!loading && !error && filtered.length === 0 && (
        <Alert severity="info">Nenhum avaliador encontrado.</Alert>
      )}

      <Grid container spacing={2}>
        {filtered.map(u => (
          <Grid key={u.id} item xs={12} md={6} lg={4}>
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={0.5}>
                  <Typography variant="h6" fontWeight={700} noWrap>
                    {u.name || (u.email || 'Sem nome')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {u.email || '—'}
                  </Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap" mt={0.5}>
                    <Chip size="small" label={u.role === 'admin' ? 'Admin' : 'Avaliador'} color={u.role === 'admin' ? 'primary' : 'default'} />
                    <Chip size="small" label={u.active ? 'Ativo' : 'Inativo'} color={u.active ? 'success' : 'warning'} />
                    {(u.categorias || []).map((c) => (
                      <Chip key={c} size="small" label={c} />
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Stack direction="row" gap={1}>
                  <Tooltip title="Editar">
                    <IconButton onClick={() => handleEdit(u.id)}><EditIcon /></IconButton>
                  </Tooltip>
                  <Tooltip title="Excluir">
                    <IconButton color="error" onClick={() => setConfirmId(u.id)}><DeleteIcon /></IconButton>
                  </Tooltip>
                </Stack>
                <Button size="small" onClick={() => handleEdit(u.id)}>Abrir</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={!!confirmId} onClose={() => setConfirmId(null)}>
        <DialogTitle>Remover avaliador</DialogTitle>
        <DialogContent>
          <DialogContentText>Tem certeza que deseja remover este avaliador? Esta ação não pode ser desfeita.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>Remover</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
