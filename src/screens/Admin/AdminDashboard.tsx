// src/screens/Admin/AdminDashboard.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Grid, Card, CardContent, Typography, Stack, Chip,
  CircularProgress, Divider, IconButton, TextField, InputAdornment, Button
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useNavigate } from 'react-router-dom'
import { listProjects } from '@services/firestore/projects'
import { getWorkAggregate, getTopEvaluatorsForWork, getUserNames } from '@services/firestore/aggregates'

type Project = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [nfMap, setNfMap] = useState<Record<string, number>>({})
  const [topEvalMap, setTopEvalMap] = useState<Record<string, Array<{ name: string; total: number }>>>({})
  const [q, setQ] = useState('')
  const nav = useNavigate()

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return projects
    return projects.filter(p =>
      (p.titulo || '').toLowerCase().includes(s) ||
      (p.categoria || '').toLowerCase().includes(s) ||
      (p.subcategoria || '').toLowerCase().includes(s) ||
      (p.tipo || '').toLowerCase().includes(s) ||
      (p.area || '').toLowerCase().includes(s)
    )
  }, [q, projects])

  const totals = useMemo(() => ({
    projetos: projects.length,
    avaliados: Object.values(nfMap).filter(v => Number.isFinite(v)).length,
    categorias: new Set(projects.map(p => p.categoria || '')).size,
  }), [projects, nfMap])

  // Carrega projetos + agregados
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const list = await listProjects()
        if (!alive) return
        setProjects(list as any)

        const nfTemp: Record<string, number> = {}
        const topTemp: Record<string, Array<{ name: string; total: number }>> = {}

        for (const p of list) {
          const agg = await getWorkAggregate(p.id)
          if (agg?.nf != null) nfTemp[p.id] = agg.nf

          const top3 = await getTopEvaluatorsForWork(p.id, 3)
          const names = await getUserNames(top3.map(t => t.uid))
          topTemp[p.id] = top3.map(t => ({
            name: names[t.uid] || t.uid,
            total: Number(t.total.toFixed(2)),
          }))
        }
        if (!alive) return
        setNfMap(nfTemp)
        setTopEvalMap(topTemp)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    const nfTemp: Record<string, number> = {}
    const topTemp: Record<string, Array<{ name: string; total: number }>> = {}
    for (const p of projects) {
      const agg = await getWorkAggregate(p.id)
      if (agg?.nf != null) nfTemp[p.id] = agg.nf
      const top3 = await getTopEvaluatorsForWork(p.id, 3)
      const names = await getUserNames(top3.map(t => t.uid))
      topTemp[p.id] = top3.map(t => ({
        name: names[t.uid] || t.uid,
        total: Number(t.total.toFixed(2)),
      }))
    }
    setNfMap(nfTemp)
    setTopEvalMap(topTemp)
    setLoading(false)
  }

  if (loading) {
    return <Stack alignItems="center" py={6}><CircularProgress /></Stack>
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2} gap={2} flexWrap="wrap">
        <Typography variant="h5" fontWeight={800}>Dashboard (Admin)</Typography>
        <Stack direction="row" gap={1}>
          <TextField
            size="small"
            placeholder="Buscar por título, categoria, área…"
            value={q}
            onChange={e => setQ(e.target.value)}
            InputProps={{
              startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>)
            }}
          />
          <IconButton onClick={handleRefresh} title="Recarregar">
            <RefreshIcon />
          </IconButton>
          <Button onClick={() => nav('/reports')} variant="outlined">Relatórios</Button>
        </Stack>
      </Stack>

      {/* KPIs */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} sm={4}>
          <Card><CardContent sx={{ p: 3 }}>
            <Typography variant="overline" color="text.secondary">Projetos</Typography>
            <Typography variant="h4" fontWeight={800}>{totals.projetos}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card><CardContent sx={{ p: 3 }}>
            <Typography variant="overline" color="text.secondary">Com Nota Final</Typography>
            <Typography variant="h4" fontWeight={800}>{totals.avaliados}</Typography>
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card><CardContent sx={{ p: 3 }}>
            <Typography variant="overline" color="text.secondary">Categorias</Typography>
            <Typography variant="h4" fontWeight={800}>{totals.categorias}</Typography>
          </CardContent></Card>
        </Grid>
      </Grid>

      {/* Cards de projetos (mesmo estilo da tela Projetos) */}
      <Grid container spacing={2}>
        {filtered.map((p) => {
          const nf = nfMap[p.id]
          const top = topEvalMap[p.id] || []
          return (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={1}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {p.titulo || '(sem título)'}
                    </Typography>

                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {p.categoria && <Chip size="small" label={`Categoria: ${p.categoria}`} />}
                      {p.subcategoria && <Chip size="small" label={p.subcategoria} />}
                      {p.tipo && <Chip size="small" label={p.tipo} />}
                      {p.area && <Chip size="small" label={p.area} />}
                    </Stack>

                    <Typography variant="body1" sx={{ mt: 1 }}>
                      <strong>Nota Final:</strong> {nf != null ? nf.toFixed(2) : '—'}
                    </Typography>

                    <Divider />

                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>
                        Avaliadores (top 3 pelo total):
                      </Typography>
                      <Stack spacing={0.5} mt={0.5}>
                        {top.length === 0 && (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                        {top.map((t, idx) => (
                          <Typography key={idx} variant="body2">
                            {idx + 1}. {t.name} — Total: {t.total.toFixed(2)}
                          </Typography>
                        ))}
                      </Stack>
                    </Box>

                    <Stack direction="row" gap={1} pt={1}>
                      <Button size="small" variant="outlined" onClick={() => nav(`/admin/projects/edit/${p.id}`)}>
                        Editar
                      </Button>
                      <Button size="small" variant="contained" onClick={() => nav(`/reports/project/${p.id}`)}>
                        Ver relatório
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
