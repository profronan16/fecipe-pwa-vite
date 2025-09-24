// src/screens/Admin/WinnersReport.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, Button, LinearProgress, Alert,
  Card, CardContent, Table, TableHead, TableRow, TableCell, TableBody,
  Chip
} from '@mui/material'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@services/firebase'

type Project = {
  id: string
  titulo: string
  categoria: string
  turma?: string
  orientador?: string
}

type Evaluation = {
  trabalhoId: string
  evaluatorEmail?: string
  avaliadorId?: string
  notas: Record<string, number>
}

type WinnerRow = {
  pos: number
  id: string
  titulo: string
  turma?: string
  orientador?: string
  finalScore: number
  evaluators: string[] // top avaliadores (por total bruto) só para exibição
}

const WEIGHTS = [0.9, 0.8, 0.7, 0.6, 0.6, 0.4, 0.4, 0.3, 0.3]
const Z = 2.5

export default function WinnersReport() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [data, setData] = useState<Record<string, WinnerRow[]>>({})

  const computeFinalScore = (p: Project, evals: Evaluation[]) => {
    if (!evals.length) return 0
    const k = (p.categoria === 'IFTECH' || p.categoria === 'Robótica') ? 6 : 9
    const perEvalScores = Array(evals.length).fill(0)

    for (let i = 1; i <= k; i++) {
      const key = `C${i}`
      const arr = evals.map(e => e.notas?.[key] ?? 0)
      const mean = arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
      const sd = Math.sqrt(arr.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (arr.length || 1)) || 1
      arr.forEach((v, idx) => {
        perEvalScores[idx] += ((v - mean) / sd + Z) * (WEIGHTS[i - 1] ?? 1)
      })
    }
    return perEvalScores.reduce((a, b) => a + b, 0) / perEvalScores.length
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      // Carrega todos os projetos + avaliações uma única vez
      const [projSnap, evalSnap] = await Promise.all([
        getDocs(collection(db, 'trabalhos')),
        getDocs(collection(db, 'avaliacoes')),
      ])

      const projects = projSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Project[]
      const evals = evalSnap.docs.map(d => (d.data() as any)) as Evaluation[]

      // Índice de avaliações por projeto
      const evalsByProject: Record<string, Evaluation[]> = {}
      evals.forEach(e => {
        if (!e.trabalhoId) return
        evalsByProject[e.trabalhoId] = evalsByProject[e.trabalhoId] || []
        evalsByProject[e.trabalhoId].push(e)
      })

      // Categorias existentes
      const cats = Array.from(new Set(projects.map(p => p.categoria))).filter(Boolean).sort()
      setCategories(cats)

      // Top 3 por categoria
      const perCat: Record<string, WinnerRow[]> = {}
      for (const cat of cats) {
        const projs = projects.filter(p => p.categoria === cat)
        const scored = projs.map(p => {
          const list = evalsByProject[p.id] || []
          // avaliadores (apenas para exibição: ordena por total bruto) — opcional
          const evalTotals = list
            .map(e => ({
              who: e.evaluatorEmail || e.avaliadorId || '—',
              total: Object.values<number>(e.notas || {}).reduce((a, b) => a + b, 0),
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 3)

          return {
            id: p.id,
            titulo: p.titulo,
            turma: p.turma,
            orientador: p.orientador,
            finalScore: computeFinalScore(p, list),
            evaluators: evalTotals.map(e => e.who),
          }
        })
          .sort((a, b) => b.finalScore - a.finalScore)
          .slice(0, 3)
          .map((r, i) => ({ pos: i + 1, ...r }))

        perCat[cat] = scored
      }

      setData(perCat)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar vencedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const flatCSV = useMemo(() => {
    // categoria;posicao;titulo;nota;turma;orientador;avaliadores
    const lines: string[] = []
    for (const cat of categories) {
      const rows = data[cat] || []
      rows.forEach(r => {
        lines.push([
          cat,
          String(r.pos),
          r.titulo,
          r.finalScore.toFixed(4),
          r.turma || '',
          r.orientador || '',
          r.evaluators.join(' | ')
        ].map(s => `"${String(s).replace(/"/g, '""')}"`).join(';'))
      })
    }
    return ['categoria;posicao;titulo;nota_final;turma;orientador;avaliadores', ...lines].join('\n')
  }, [categories, data])

  const exportCSV = () => {
    const blob = new Blob([flatCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'winners-por-categoria.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box p={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} alignItems={{ xs: 'stretch', sm: 'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>🏆 Top 3 por Categoria</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" onClick={load}>Recarregar</Button>
          <Button variant="contained" onClick={exportCSV} disabled={!categories.length}>Exportar CSV</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!categories.length && !loading ? (
        <Alert severity="info">Nenhuma categoria encontrada.</Alert>
      ) : null}

      <Stack gap={3}>
        {categories.map(cat => {
          const rows = data[cat] || []
          return (
            <Card key={cat}>
              <CardContent>
                <Box sx={{ width: '100%', overflowX: 'auto' }}>
                  <Stack direction="row" gap={1} alignItems="center" mb={1}>
                    <Chip color="primary" label={cat} />
                    <Typography variant="subtitle2" color="text.secondary">
                      {rows.length ? `Top ${rows.length}` : 'Sem projetos com avaliações'}
                    </Typography>
                  </Stack>

                  {!rows.length ? (
                    <Alert severity="info">Sem projetos suficientes para ranquear.</Alert>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Posição</TableCell>
                          <TableCell>Título</TableCell>
                          <TableCell>Turma</TableCell>
                          <TableCell>Orientador</TableCell>
                          <TableCell align="right">Nota Final</TableCell>
                          <TableCell>Avaliadores (amostra)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rows.map(r => (
                          <TableRow key={r.id} hover>
                            <TableCell>{r.pos}º</TableCell>
                            <TableCell>{r.titulo}</TableCell>
                            <TableCell>{r.turma || '—'}</TableCell>
                            <TableCell>{r.orientador || '—'}</TableCell>
                            <TableCell align="right">{r.finalScore.toFixed(2)}</TableCell>
                            <TableCell>{r.evaluators.length ? r.evaluators.join(', ') : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              </CardContent>
            </Card>
          )
        })}
      </Stack>
    </Box>
  )
}
