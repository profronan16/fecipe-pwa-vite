// src/screens/Reports/WinnersReport.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Stack, TextField, MenuItem,
  LinearProgress, Alert, Table, TableHead, TableRow, TableCell, TableBody
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@services/firebase'

type Row = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  score?: number
}

const CATEGORIAS = ['IFTECH', 'Feira de Ciências', 'Comunicação Oral', 'Banner'] as const
const SUBCATEGORIAS = ['Ensino', 'Extensão', 'Pesquisa/Inovação'] as const

// >>> Atualizado: inclui "Servidor"
const TIPOS_FEIRA   = ['Fundamental', 'Ensino Médio', 'Superior'] as const
const TIPOS_COMORAL = ['Ensino Médio', 'Superior', 'Pós-graduação', 'Servidor'] as const
const TIPOS_BANNER  = ['Ensino Médio', 'Superior', 'Servidor'] as const

function tipoOptions(categoria: string) {
  if (categoria === 'Feira de Ciências') return TIPOS_FEIRA
  if (categoria === 'Comunicação Oral') return TIPOS_COMORAL
  if (categoria === 'Banner') return TIPOS_BANNER
  return []
}

export default function WinnersReport() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  const [cat, setCat] = useState<string>('')
  const [sub, setSub] = useState<string>('')
  const [tipo, setTipo] = useState<string>('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true); setError(null)
        const snap = await getDocs(collection(db, 'trabalhos'))
        const list: Row[] = snap.docs.map(d => {
          const data = d.data() as any
          return {
            id: d.id,
            titulo: data.titulo || '',
            categoria: data.categoria || '',
            subcategoria: data.subcategoria || '',
            tipo: data.tipo || '',
            score: data.score || undefined, // use sua métrica final aqui
          }
        })
        if (!alive) return
        setRows(list)
      } catch (e:any) {
        if (alive) setError(e?.message || 'Erro ao carregar')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const tiposDisponiveis = useMemo(() => tipoOptions(cat), [cat])

  const finalists = useMemo(() => {
    let list = [...rows]
    if (cat) list = list.filter(r => (r.categoria || '') === cat)
    if (sub && (cat === 'Comunicação Oral' || cat === 'Banner')) {
      list = list.filter(r => (r.subcategoria || '') === sub)
    }
    if (tipo && (cat === 'Feira de Ciências' || cat === 'Comunicação Oral' || cat === 'Banner')) {
      list = list.filter(r => (r.tipo || '') === tipo)
    }
    // ordena por score desc e pega top 3
    list.sort((a,b) => {
      if (a.score != null && b.score != null) return (b.score - a.score)
      return (a.titulo || '').localeCompare(b.titulo || '')
    })
    return list.slice(0,3)
  }, [rows, cat, sub, tipo])

  return (
    <Box>
      <Typography variant="h6" fontWeight={800} mb={2}>Vencedores (Top 3 por filtro)</Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} gap={2} mb={2}>
        <TextField
          select
          label="Categoria"
          value={cat}
          onChange={(e)=>{ setCat(e.target.value); setSub(''); setTipo('') }}
          sx={{ minWidth: 220 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {CATEGORIAS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>

        {(cat === 'Comunicação Oral' || cat === 'Banner') && (
          <TextField
            select
            label="Subcategoria"
            value={sub}
            onChange={(e)=>setSub(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todas</MenuItem>
            {SUBCATEGORIAS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        )}

        {(cat === 'Feira de Ciências' || cat === 'Comunicação Oral' || cat === 'Banner') && (
          <TextField
            select
            label="Tipo"
            value={tipo}
            onChange={(e)=>setTipo(e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Todos</MenuItem>
            {tiposDisponiveis.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
        )}
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card variant="outlined">
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Posição</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Subcategoria</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {finalists.map((r, idx) => (
                <TableRow key={r.id}>
                  <TableCell>{idx + 1}º</TableCell>
                  <TableCell>{r.titulo}</TableCell>
                  <TableCell>{r.categoria}</TableCell>
                  <TableCell>{r.subcategoria}</TableCell>
                  <TableCell>{r.tipo}</TableCell>
                  <TableCell>{r.score != null ? r.score.toFixed(3) : '-'}</TableCell>
                </TableRow>
              ))}
              {!finalists.length && !loading && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Alert severity="info">Nenhum registro para os filtros atuais.</Alert>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  )
}
