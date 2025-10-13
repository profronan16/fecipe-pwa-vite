// src/screens/Reports/WinnersReport.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Stack, TextField, MenuItem, Grid, Card, CardContent, Chip, CircularProgress
} from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import { listProjects } from '@services/firestore/projects'
import { getWorkAggregate } from '@services/firestore/aggregates'

type Project = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
}

export default function WinnersReport() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [nfMap, setNfMap] = useState<Record<string, number>>({})
  const [cat, setCat] = useState<string>('')
  const [sub, setSub] = useState<string>('')
  const [tipo, setTipo] = useState<string>('')

  const cats = useMemo(() => Array.from(new Set(projects.map(p => p.categoria).filter(Boolean))) as string[], [projects])
  const subs = useMemo(() => {
    const base = projects.filter(p => !cat || p.categoria === cat)
    return Array.from(new Set(base.map(p => p.subcategoria).filter(Boolean))) as string[]
  }, [projects, cat])
  const tipos = useMemo(() => {
    const base = projects.filter(p => (!cat || p.categoria === cat) && (!sub || p.subcategoria === sub))
    return Array.from(new Set(base.map(p => p.tipo).filter(Boolean))) as string[]
  }, [projects, cat, sub])

  const winners = useMemo(() => {
    const filtered = projects
      .filter(p => (!cat || p.categoria === cat) && (!sub || p.subcategoria === sub) && (!tipo || p.tipo === tipo))
      .map(p => ({ ...p, nf: nfMap[p.id] ?? -Infinity }))
      .sort((a, b) => (b.nf - a.nf))
    return filtered.slice(0, 3)
  }, [projects, nfMap, cat, sub, tipo])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      try {
        const list = await listProjects()
        if (!alive) return
        setProjects(list as any)

        const nf: Record<string, number> = {}
        for (const p of list) {
          const agg = await getWorkAggregate(p.id)
          if (agg?.nf != null) nf[p.id] = agg.nf
        }
        if (!alive) return
        setNfMap(nf)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  if (loading) return <Stack alignItems="center" py={6}><CircularProgress /></Stack>

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Vencedores (Top 3 por Nota Final)
      </Typography>

      <Stack direction="row" gap={2} mb={2} flexWrap="wrap">
        <TextField select size="small" label="Categoria" value={cat} onChange={e => { setCat(e.target.value); setSub(''); setTipo('') }}>
          <MenuItem value="">(todas)</MenuItem>
          {cats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Subcategoria" value={sub} onChange={e => { setSub(e.target.value); setTipo('') }} disabled={!cat}>
          <MenuItem value="">(todas)</MenuItem>
          {subs.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)} disabled={!cat}>
          <MenuItem value="">(todos)</MenuItem>
          {tipos.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
      </Stack>

      <Grid container spacing={2}>
        {winners.map((p, idx) => (
          <Grid item xs={12} md={4} key={p.id}>
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" gap={1} mb={1}>
                  <EmojiEventsIcon color={idx === 0 ? 'warning' : idx === 1 ? 'secondary' : 'disabled'} />
                  <Typography variant="h6" fontWeight={700}>
                    {idx + 1}º — {p.titulo}
                  </Typography>
                </Stack>
                <Stack direction="row" gap={1} flexWrap="wrap" mb={1}>
                  {p.categoria && <Chip size="small" label={p.categoria} />}
                  {p.subcategoria && <Chip size="small" label={p.subcategoria} />}
                  {p.tipo && <Chip size="small" label={p.tipo} />}
                </Stack>
                <Typography>
                  <strong>Nota Final:</strong> {Number.isFinite(p.nf) ? p.nf.toFixed(4) : '—'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
