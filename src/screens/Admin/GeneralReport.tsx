// src/screens/Admin/GeneralReport.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, TextField, Chip, LinearProgress, Alert,
  Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody, TableSortLabel, Button
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@services/firebase'

type Project = {
  id: string
  titulo: string
  alunos: string[]
  orientador: string
  turma: string
  anoSemestre: string
  categoria: string
}

type Evaluation = {
  trabalhoId: string
  notas: Record<string, number>
}

type Row = Project & {
  finalScore: number
  evalCount: number
}

const WEIGHTS = [0.9, 0.8, 0.7, 0.6, 0.6, 0.4, 0.4, 0.3, 0.3] // igual ao mobile
const Z = 2.5

type OrderBy = 'titulo' | 'categoria' | 'evalCount' | 'finalScore'
type Order = 'asc' | 'desc'

export default function GeneralReport() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filterCat, setFilterCat] = useState<string>('Todos')
  const [search, setSearch] = useState('')

  const [orderBy, setOrderBy] = useState<OrderBy>('finalScore')
  const [order, setOrder] = useState<Order>('desc')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // 1) carrega TODOS os projetos
      const projSnap = await getDocs(collection(db, 'trabalhos'))
      const projects: Project[] = projSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

      // categorias únicas (para filtro)
      const cats = Array.from(new Set(projects.map(p => p.categoria))).filter(Boolean)
      setCategories(cats)

      // 2) carrega TODAS as avaliações (evita N queries)
      const evalSnap = await getDocs(collection(db, 'avaliacoes'))
      const evals: Evaluation[] = evalSnap.docs.map(d => (d.data() as any))

      // 3) agrupa avaliações por trabalhoId
      const byProject: Record<string, Evaluation[]> = {}
      evals.forEach(e => {
        const key = e.trabalhoId
        if (!key) return
        byProject[key] = byProject[key] || []
        byProject[key].push(e)
      })

      // 4) monta linhas calculando nota final conforme o mobile
      const data: Row[] = projects.map(p => {
        const list = byProject[p.id] || []
        const evalCount = list.length
        let finalScore = 0

        if (evalCount > 0) {
          const k = (p.categoria === 'IFTECH' || p.categoria === 'Robótica') ? 6 : 9
          const perEvalScores = Array(evalCount).fill(0)

          for (let i = 1; i <= k; i++) {
            const key = `C${i}`
            const arr = list.map(e => e.notas?.[key] ?? 0)
            const mean = arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
            const sd = Math.sqrt(arr.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (arr.length || 1)) || 1
            arr.forEach((v, idx) => {
              perEvalScores[idx] += ((v - mean) / sd + Z) * (WEIGHTS[i - 1] ?? 1)
            })
          }

          finalScore = perEvalScores.reduce((a, b) => a + b, 0) / perEvalScores.length
        }

        return { ...p, finalScore, evalCount }
      })

      setRows(data)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSort = (key: OrderBy) => {
    if (orderBy === key) setOrder(order === 'asc' ? 'desc' : 'asc')
    else { setOrderBy(key); setOrder('desc') }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const arr = rows
      .filter(r => (filterCat === 'Todos' ? true : r.categoria === filterCat))
      .filter(r => !q || (r.titulo || '').toLowerCase().includes(q))
    const sorted = [...arr].sort((a, b) => {
      const dir = order === 'asc' ? 1 : -1
      if (orderBy === 'titulo') return a.titulo.localeCompare(b.titulo) * dir
      if (orderBy === 'categoria') return a.categoria.localeCompare(b.categoria) * dir
      if (orderBy === 'evalCount') return (a.evalCount - b.evalCount) * dir
      return (a.finalScore - b.finalScore) * dir
    })
    return sorted
  }, [rows, search, filterCat, order, orderBy])

  const exportCSV = () => {
    const header = ['titulo', 'categoria', 'avaliacoes', 'finalScore']
    const lines = filtered.map(r =>
      [r.titulo, r.categoria, String(r.evalCount), r.finalScore.toFixed(4)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    )
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'relatorio-geral.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box p={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>📋 Relatório Geral</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" onClick={load}>Recarregar</Button>
          <Button variant="contained" onClick={exportCSV}>Exportar CSV</Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <TextField
          placeholder="Buscar por título…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
        />
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <Chip
            label="Todos"
            color={filterCat === 'Todos' ? 'primary' : 'default'}
            onClick={() => setFilterCat('Todos')}
          />
          {categories.map(c => (
            <Chip
              key={c}
              label={c}
              color={filterCat === c ? 'primary' : 'default'}
              onClick={() => setFilterCat(c)}
            />
          ))}
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={orderBy === 'titulo' ? order : false as any}>
                    <TableSortLabel
                      active={orderBy === 'titulo'}
                      direction={orderBy === 'titulo' ? order : 'asc'}
                      onClick={() => handleSort('titulo')}
                    >
                      Título
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === 'categoria' ? order : false as any}>
                    <TableSortLabel
                      active={orderBy === 'categoria'}
                      direction={orderBy === 'categoria' ? order : 'asc'}
                      onClick={() => handleSort('categoria')}
                    >
                      Categoria
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={orderBy === 'evalCount' ? order : false as any}>
                    <TableSortLabel
                      active={orderBy === 'evalCount'}
                      direction={orderBy === 'evalCount' ? order : 'desc'}
                      onClick={() => handleSort('evalCount')}
                    >
                      Avaliações
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={orderBy === 'finalScore' ? order : false as any}>
                    <TableSortLabel
                      active={orderBy === 'finalScore'}
                      direction={orderBy === 'finalScore' ? order : 'desc'}
                      onClick={() => handleSort('finalScore')}
                    >
                      Nota Final
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id} hover>
                    <TableCell>{r.titulo}</TableCell>
                    <TableCell>{r.categoria}</TableCell>
                    <TableCell align="right">{r.evalCount}</TableCell>
                    <TableCell align="right">{r.finalScore.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {!filtered.length && !loading && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Alert severity="info">Nenhum projeto encontrado.</Alert>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
