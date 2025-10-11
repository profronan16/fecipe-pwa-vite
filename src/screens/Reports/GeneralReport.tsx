// src/screens/Reports/GeneralReport.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, Card, CardContent, Alert, LinearProgress,
  TextField, MenuItem, Button, Table, TableHead, TableRow, TableCell, TableBody,
  TableSortLabel, Chip
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@services/firebase'

// ===== Domínio (listas coerentes com o app) =====
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

type ProjectDoc = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
  apresentador?: string
  autores?: string[]
}

type EvaluationDoc = {
  trabalhoId: string
  notas?: Record<string, number>
}

type Row = {
  id: string
  titulo: string
  categoria: string
  subcategoria: string
  tipo: string
  area?: string
  avg: number
  count: number
  stddev: number
}

type Order = 'asc' | 'desc'
type OrderKey = keyof Pick<Row, 'titulo' | 'categoria' | 'subcategoria' | 'tipo' | 'area' | 'avg' | 'count' | 'stddev'>

// ===== Estatística =====
function sum(arr: number[]) { return arr.reduce((a,b)=>a+b,0) }
function mean(arr: number[]) { return arr.length ? sum(arr)/arr.length : 0 }
function stdDev(arr: number[]) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const v = mean(arr.map(x => (x - m) ** 2))
  return Math.sqrt(v)
}

// ===== CSV =====
function exportCsv(filename: string, rows: Array<Record<string, any>>) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ===== Página =====
export default function GeneralReport() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [evals, setEvals] = useState<EvaluationDoc[]>([])

  // Filtros
  const [qTitle, setQTitle] = useState('')
  const [fCategoria, setFCategoria] = useState<Categoria>('')
  const [fSub, setFSub] = useState<Subcategoria>('')
  const [fTipo, setFTipo] = useState<Tipo>('')

  // Ordenação
  const [orderBy, setOrderBy] = useState<OrderKey>('avg')
  const [order, setOrder] = useState<Order>('desc')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const sProj = await getDocs(collection(db, 'trabalhos'))
        const projs: ProjectDoc[] = sProj.docs.map(d => {
          const data = d.data() as any
          return {
            id: d.id,
            titulo: clean(data.titulo),
            categoria: clean(data.categoria),
            subcategoria: clean(data.subcategoria),
            tipo: clean(data.tipo),
            area: clean(data.area),
            autores: Array.isArray(data.autores) ? data.autores : [],
            apresentador: clean(data.apresentador),
          }
        })

        const sEv = await getDocs(collection(db, 'avaliacoes'))
        const avs: EvaluationDoc[] = sEv.docs.map(d => {
          const data = d.data() as any
          return {
            trabalhoId: String(data.trabalhoId || ''),
            notas: data.notas || {},
          }
        })

        if (!alive) return
        setProjects(projs)
        setEvals(avs)
      } catch (e: any) {
        if (alive) setError(e?.message || 'Erro ao carregar dados')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Monta linhas com média/contagem/stddev
  const rows: Row[] = useMemo(() => {
    if (!projects.length) return []
    const totalsByWork = new Map<string, number[]>()

    evals.forEach(e => {
      if (!e.trabalhoId || !e.notas) return
      const total = Object.values(e.notas).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
      if (!totalsByWork.has(e.trabalhoId)) totalsByWork.set(e.trabalhoId, [])
      totalsByWork.get(e.trabalhoId)!.push(total)
    })

    const result: Row[] = projects.map(p => {
      const vals = totalsByWork.get(p.id) || []
      const m = mean(vals)
      const sd = stdDev(vals)
      return {
        id: p.id,
        titulo: p.titulo || 'Sem título',
        categoria: p.categoria || '',
        subcategoria: p.subcategoria || '',
        tipo: p.tipo || '',
        area: p.area || '',
        avg: Number(m.toFixed(4)),
        count: vals.length,
        stddev: Number(sd.toFixed(4)),
      }
    })

    return result
  }, [projects, evals])

  // Aplica filtros
  const filtered = useMemo(() => {
    const q = normalize(qTitle)
    const ct = clean(fCategoria)
    const sb = clean(fSub)
    const tp = clean(fTipo)

    return rows.filter(r => {
      if (q && !normalize(r.titulo).includes(q)) return false
      if (ct && clean(r.categoria) !== ct) return false
      if (sb && clean(r.subcategoria) !== sb) return false
      if (tp && clean(r.tipo) !== tp) return false
      return true
    })
  }, [rows, qTitle, fCategoria, fSub, fTipo])

  // Ordenação
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const A: any = a[orderBy]
      const B: any = b[orderBy]
      if (A === B) {
        // critério de desempate: média desc, depois título
        if (b.avg !== a.avg) return b.avg - a.avg
        return a.titulo.localeCompare(b.titulo)
      }
      if (order === 'asc') return A > B ? 1 : -1
      return A < B ? 1 : -1
    })
    return arr
  }, [filtered, orderBy, order])

  const tipoOptions = useMemo(() => optionsTipoFor(fCategoria), [fCategoria])

  const handleSort = (key: OrderKey) => {
    if (orderBy === key) {
      setOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(key)
      setOrder(key === 'titulo' ? 'asc' : 'desc')
    }
  }

  const exportCurrent = () => {
    const rows = sorted.map((r, i) => ({
      posicao: i + 1,
      titulo: r.titulo,
      categoria: r.categoria,
      subcategoria: r.subcategoria,
      tipo: r.tipo,
      area: r.area || '',
      media: r.avg.toFixed(2),
      avaliacoes: r.count,
      desvio_padrao: r.stddev.toFixed(3),
    }))
    exportCsv('relatorio_geral.csv', rows)
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} mb={2}>
        <Typography variant="h5" fontWeight={800}>Relatório Geral — Projetos Avaliados</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button startIcon={<DownloadIcon />} variant="contained" onClick={exportCurrent} disabled={!sorted.length}>
            Exportar CSV
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
              onChange={(e) => setQTitle(e.target.value)}
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

      {!loading && !error && !sorted.length && (
        <Alert severity="info">Nenhum projeto encontrado com os filtros atuais.</Alert>
      )}

      {!!sorted.length && (
        <Card variant="outlined">
          <CardContent>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell sortDirection={orderBy === 'titulo' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'titulo'}
                      direction={orderBy === 'titulo' ? order : 'asc'}
                      onClick={() => handleSort('titulo')}
                    >
                      Título
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === 'categoria' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'categoria'}
                      direction={orderBy === 'categoria' ? order : 'asc'}
                      onClick={() => handleSort('categoria')}
                    >
                      Categoria
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === 'subcategoria' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'subcategoria'}
                      direction={orderBy === 'subcategoria' ? order : 'asc'}
                      onClick={() => handleSort('subcategoria')}
                    >
                      Subcategoria
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === 'tipo' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'tipo'}
                      direction={orderBy === 'tipo' ? order : 'asc'}
                      onClick={() => handleSort('tipo')}
                    >
                      Tipo
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={orderBy === 'area' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'area'}
                      direction={orderBy === 'area' ? order : 'asc'}
                      onClick={() => handleSort('area')}
                    >
                      Área
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={orderBy === 'avg' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'avg'}
                      direction={orderBy === 'avg' ? order : 'desc'}
                      onClick={() => handleSort('avg')}
                    >
                      Média
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={orderBy === 'count' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'count'}
                      direction={orderBy === 'count' ? order : 'desc'}
                      onClick={() => handleSort('count')}
                    >
                      Avaliações
                    </TableSortLabel>
                  </TableCell>
                  <TableCell align="right" sortDirection={orderBy === 'stddev' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'stddev'}
                      direction={orderBy === 'stddev' ? order : 'asc'}
                      onClick={() => handleSort('stddev')}
                    >
                      Desvio Padrão
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography>{r.titulo}</Typography>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                          {r.categoria && <Chip size="small" label={r.categoria} />}
                          {r.subcategoria && <Chip size="small" label={r.subcategoria} />}
                          {r.tipo && <Chip size="small" label={r.tipo} />}
                          {r.area && <Chip size="small" label={r.area} />}
                        </Stack>
                      </Stack>
                    </TableCell>
                    <TableCell>{r.categoria}</TableCell>
                    <TableCell>{r.subcategoria}</TableCell>
                    <TableCell>{r.tipo}</TableCell>
                    <TableCell>{r.area}</TableCell>
                    <TableCell align="right"><strong>{r.avg.toFixed(2)}</strong></TableCell>
                    <TableCell align="right">{r.count}</TableCell>
                    <TableCell align="right">{r.stddev.toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
