// src/screens/Reports/WinnersReport.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, Card, CardContent, Alert, LinearProgress,
  Grid, TextField, MenuItem, Chip, Button, Divider
} from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import { collection, getDocs } from 'firebase/firestore'
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

type RankedItem = {
  id: string
  titulo: string
  categoria: string
  subcategoria: string
  tipo: string
  area?: string
  avgScore: number
  evalCount: number
}

type GroupKey = string // `${categoria}|${subcategoria}|${tipo}`

const groupKey = (c: string, s: string, t: string): GroupKey =>
  [clean(c), clean(s), clean(t)].join('|')

const groupLabel = (c: string, s: string, t: string) => {
  const cc = clean(c)
  const ss = clean(s)
  const tt = clean(t)
  if (!cc) return '— sem categoria —'
  // Exibição amigável
  if (cc === 'Feira de Ciências') return `Feira de Ciências${tt ? ` — ${tt}` : ''}`
  if (cc === 'Comunicação Oral') return `Comunicação Oral${ss ? ` — ${ss}` : ''}${tt ? ` — ${tt}` : ''}`
  if (cc === 'Banner') return `Banner${ss ? ` — ${ss}` : ''}${tt ? ` — ${tt}` : ''}`
  return cc // IFTECH
}

// CSV
function exportCsv(filename: string, rows: Array<Record<string, any>>) {
  const headers = Object.keys(rows[0] ?? {})
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
export default function WinnersReport() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [projects, setProjects] = useState<ProjectDoc[]>([])
  const [evals, setEvals] = useState<EvaluationDoc[]>([])

  // filtros opcionais para focar em um grupo específico
  const [fCategoria, setFCategoria] = useState<Categoria>('')
  const [fSub, setFSub] = useState<Subcategoria>('')
  const [fTipo, setFTipo] = useState<Tipo>('')

  // Carregar Firestore
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

  // Calcula total de cada avaliação e agrega por trabalho (média)
  const rankedAll: RankedItem[] = useMemo(() => {
    if (!projects.length) return []

    // soma/contagem por trabalho
    const totals = new Map<string, { sum: number, count: number }>()
    evals.forEach(e => {
      if (!e.trabalhoId || !e.notas) return
      const total = Object.values(e.notas).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
      if (!totals.has(e.trabalhoId)) totals.set(e.trabalhoId, { sum: 0, count: 0 })
      const agg = totals.get(e.trabalhoId)!
      agg.sum += total
      agg.count += 1
    })

    // monta a lista
    const items: RankedItem[] = projects.map(p => {
      const agg = totals.get(p.id)
      const avg = agg && agg.count ? (agg.sum / agg.count) : 0
      return {
        id: p.id,
        titulo: p.titulo || 'Sem título',
        categoria: p.categoria || '',
        subcategoria: p.subcategoria || '',
        tipo: p.tipo || '',
        area: p.area,
        avgScore: Number(avg.toFixed(4)),
        evalCount: agg?.count ?? 0,
      }
    })

    // ordena por média desc, depois por count desc, depois por título
    items.sort((a, b) => {
      if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore
      if (b.evalCount !== a.evalCount) return b.evalCount - a.evalCount
      return a.titulo.localeCompare(b.titulo)
    })

    return items
  }, [projects, evals])

  // Agrupa por (categoria|subcategoria|tipo) e pega Top 3 de cada
  const groupsTop3: Array<{ key: GroupKey, label: string, items: RankedItem[] }> = useMemo(() => {
    const bucket = new Map<GroupKey, RankedItem[]>()
    for (const it of rankedAll) {
      const k = groupKey(it.categoria, it.subcategoria, it.tipo)
      if (!bucket.has(k)) bucket.set(k, [])
      bucket.get(k)!.push(it)
    }

    // ordena dentro de cada grupo e pega top 3
    const result: Array<{ key: GroupKey, label: string, items: RankedItem[] }> = []
    for (const [k, arr] of bucket) {
      // ignora grupos totalmente vazios (sem categoria)
      const [c, s, t] = k.split('|')
      if (!c) continue

      const sorted = [...arr].sort((a, b) => {
        if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore
        if (b.evalCount !== a.evalCount) return b.evalCount - a.evalCount
        return a.titulo.localeCompare(b.titulo)
      })
      result.push({
        key: k,
        label: groupLabel(c, s, t),
        items: sorted.slice(0, 3),
      })
    }

    // Ordena grupos por nome
    result.sort((a, b) => a.label.localeCompare(b.label))
    return result
  }, [rankedAll])

  // Foco num grupo selecionado (opcional)
  const filteredGroups = useMemo(() => {
    if (!fCategoria && !fSub && !fTipo) return groupsTop3

    const ct = clean(fCategoria)
    const sb = clean(fSub)
    const tp = clean(fTipo)

    return groupsTop3.filter(g => {
      const [gc, gs, gt] = g.key.split('|').map(clean)
      if (ct && gc !== ct) return false
      if (sb && gs !== sb) return false
      if (tp && gt !== tp) return false
      return true
    })
  }, [groupsTop3, fCategoria, fSub, fTipo])

  const tipoOptions = useMemo(() => optionsTipoFor(fCategoria), [fCategoria])

  // Exportações
  const exportCurrentGroups = () => {
    const rows: Record<string, any>[] = []
    filteredGroups.forEach(g => {
      g.items.forEach((it, idx) => {
        rows.push({
          grupo: g.label,
          colocacao: idx + 1,
          titulo: it.titulo,
          categoria: it.categoria,
          subcategoria: it.subcategoria,
          tipo: it.tipo,
          area: it.area || '',
          media: it.avgScore.toFixed(2),
          avaliacoes: it.evalCount,
        })
      })
    })
    if (!rows.length) return
    exportCsv('winners_por_grupo.csv', rows)
  }

  const exportOverall = () => {
    if (!rankedAll.length) return
    const rows = rankedAll.map((it, i) => ({
      posicao: i + 1,
      titulo: it.titulo,
      categoria: it.categoria,
      subcategoria: it.subcategoria,
      tipo: it.tipo,
      area: it.area || '',
      media: it.avgScore.toFixed(2),
      avaliacoes: it.evalCount,
    }))
    exportCsv('ranking_geral.csv', rows)
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} mb={2}>
        <Typography variant="h5" fontWeight={800}>Relatório — Vencedores (Top 3 por Grupo) e Ranking Geral</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportCurrentGroups} disabled={!filteredGroups.length}>
            Exportar Top 3 (grupos)
          </Button>
          <Button startIcon={<DownloadIcon />} variant="contained" onClick={exportOverall} disabled={!rankedAll.length}>
            Exportar Ranking Geral
          </Button>
        </Stack>
      </Stack>

      {/* Filtros opcionais para focar em um grupo específico */}
      <Card sx={{ mb: 2 }} variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
            <TextField
              select
              label="Categoria"
              value={fCategoria}
              onChange={(e) => { setFCategoria(e.target.value as Categoria); setFSub(''); setFTipo('') }}
              sx={{ minWidth: 220 }}
              size="small"
            >
              <MenuItem value="">Todas</MenuItem>
              {CATEGORIAS.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>

            {(fCategoria === 'Comunicação Oral' || fCategoria === 'Banner') && (
              <TextField
                select
                label="Subcategoria"
                value={fSub}
                onChange={(e) => setFSub(e.target.value as Subcategoria)}
                sx={{ minWidth: 220 }}
                size="small"
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
                onChange={(e) => setFTipo(e.target.value as Tipo)}
                sx={{ minWidth: 220 }}
                size="small"
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

      {/* Top 3 por grupo (após filtros) */}
      {!loading && !error && (
        <>
          <Typography variant="h6" fontWeight={800} mb={1}>Top 3 por Grupo</Typography>
          <Grid container spacing={2}>
            {filteredGroups.map((g) => (
              <Grid item xs={12} md={6} lg={4} key={g.key}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography fontWeight={700} gutterBottom>{g.label}</Typography>
                    {!g.items.length ? (
                      <Alert severity="info" variant="outlined">Sem projetos avaliados neste grupo.</Alert>
                    ) : (
                      <Stack spacing={1.5}>
                        {g.items.map((it, idx) => (
                          <Box key={it.id}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack spacing={0.5}>
                                <Typography fontWeight={700}>{idx + 1}º — {it.titulo}</Typography>
                                <Stack direction="row" gap={1} flexWrap="wrap">
                                  {it.categoria && <Chip size="small" label={it.categoria} />}
                                  {it.subcategoria && <Chip size="small" label={it.subcategoria} />}
                                  {it.tipo && <Chip size="small" label={it.tipo} />}
                                  {it.area && <Chip size="small" label={it.area} />}
                                </Stack>
                              </Stack>
                              <Stack alignItems="flex-end">
                                <Typography fontWeight={800}>{it.avgScore.toFixed(2)}</Typography>
                                <Typography variant="caption" color="text.secondary">{it.evalCount} avaliação(ões)</Typography>
                              </Stack>
                            </Stack>
                            {idx < g.items.length - 1 && <Divider sx={{ my: 1.25 }} />}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Ranking geral */}
          <Typography variant="h6" fontWeight={800} mb={1}>Ranking Geral</Typography>
          {rankedAll.length === 0 ? (
            <Alert severity="info">Nenhum projeto com avaliação encontrada.</Alert>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.25}>
                  {rankedAll.map((it, i) => (
                    <Box key={it.id}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack spacing={0.5}>
                          <Typography fontWeight={700}>{i + 1}º — {it.titulo}</Typography>
                          <Stack direction="row" gap={1} flexWrap="wrap">
                            {it.categoria && <Chip size="small" label={it.categoria} />}
                            {it.subcategoria && <Chip size="small" label={it.subcategoria} />}
                            {it.tipo && <Chip size="small" label={it.tipo} />}
                            {it.area && <Chip size="small" label={it.area} />}
                          </Stack>
                        </Stack>
                        <Stack alignItems="flex-end">
                          <Typography fontWeight={800}>{it.avgScore.toFixed(2)}</Typography>
                          <Typography variant="caption" color="text.secondary">{it.evalCount} avaliação(ões)</Typography>
                        </Stack>
                      </Stack>
                      {i < rankedAll.length - 1 && <Divider sx={{ my: 1.25 }} />}
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  )
}
