// src/screens/Reports/GeneralReport.tsx
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Stack, TextField, MenuItem, Button,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, CircularProgress
} from '@mui/material'
import { listProjects } from '@services/firestore/projects'
import { getWorkAggregate } from '@services/firestore/aggregates'

type Project = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
}

export default function GeneralReport() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [nfMap, setNfMap] = useState<Record<string, number>>({})
  const [cat, setCat] = useState<string>('')           // filtro categoria
  const [sub, setSub] = useState<string>('')           // filtro subcategoria
  const [tipo, setTipo] = useState<string>('')         // filtro tipo
  const [q, setQ] = useState('')                       // busca

  const cats = useMemo(() => Array.from(new Set(projects.map(p => p.categoria).filter(Boolean))) as string[], [projects])
  const subs = useMemo(() => {
    const base = projects.filter(p => !cat || p.categoria === cat)
    return Array.from(new Set(base.map(p => p.subcategoria).filter(Boolean))) as string[]
  }, [projects, cat])
  const tipos = useMemo(() => {
    const base = projects.filter(p => (!cat || p.categoria === cat) && (!sub || p.subcategoria === sub))
    return Array.from(new Set(base.map(p => p.tipo).filter(Boolean))) as string[]
  }, [projects, cat, sub])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return projects
      .filter(p => (!cat || p.categoria === cat) && (!sub || p.subcategoria === sub) && (!tipo || p.tipo === tipo))
      .filter(p => !s || (p.titulo || '').toLowerCase().includes(s))
      .map(p => ({ ...p, nf: nfMap[p.id] ?? -Infinity }))
      .sort((a, b) => (b.nf - a.nf))
  }, [projects, nfMap, cat, sub, tipo, q])

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

  const exportCSV = () => {
    const headers = ['Titulo', 'Categoria', 'Subcategoria', 'Tipo', 'NF']
    const rows = filtered.map(p => [
      `"${(p.titulo || '').replace(/"/g, '""')}"`,
      `"${(p.categoria || '').replace(/"/g, '""')}"`,
      `"${(p.subcategoria || '').replace(/"/g, '""')}"`,
      `"${(p.tipo || '').replace(/"/g, '""')}"`,
      (Number.isFinite(p.nf) ? p.nf.toFixed(4) : '')
    ])
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'relatorio_geral.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <Stack alignItems="center" py={6}><CircularProgress /></Stack>

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>Relatório Geral (por Nota Final)</Typography>

      <Stack direction="row" gap={2} mb={2} flexWrap="wrap">
        <TextField select size="small" label="Categoria" value={cat} onChange={e => { setCat(e.target.value); setSub(''); setTipo('') }}>
          <MenuItem value="">Todas</MenuItem>
          {cats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Subcategoria" value={sub} onChange={e => { setSub(e.target.value); setTipo('') }} disabled={!cat}>
          <MenuItem value="">Todas</MenuItem>
          {subs.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)} disabled={!cat}>
          <MenuItem value="">Todos</MenuItem>
          {tipos.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Busca por título" value={q} onChange={e => setQ(e.target.value)} />
        <Button onClick={exportCSV} variant="outlined">Exportar CSV</Button>
      </Stack>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Título</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell>Subcategoria</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell align="right">Nota Final</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id} hover>
                <TableCell>{p.titulo}</TableCell>
                <TableCell>{p.categoria}</TableCell>
                <TableCell>{p.subcategoria}</TableCell>
                <TableCell>{p.tipo}</TableCell>
                <TableCell align="right">{Number.isFinite(p.nf) ? p.nf.toFixed(4) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  )
}
