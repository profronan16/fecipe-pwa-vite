// src/screens/Admin/ChartsReport.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Stack, Typography, LinearProgress, Alert, Button, Card, CardContent,
  Grid, Chip, Divider, Tooltip
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
  notas?: Record<string, number>
}

type Counts = Record<string, number>

export default function ChartsReport(){
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [evalsByProject, setEvalsByProject] = useState<Record<string, number>>({})

  const load = useCallback(async ()=>{
    setLoading(true); setError(null)
    try{
      const [pSnap, eSnap] = await Promise.all([
        getDocs(collection(db,'trabalhos')),
        getDocs(collection(db,'avaliacoes')),
      ])

      const p: Project[] = pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      const evals = eSnap.docs.map(d => (d.data() as any as Evaluation))

      const eByP: Record<string, number> = {}
      evals.forEach(e => {
        if(!e.trabalhoId) return
        eByP[e.trabalhoId] = (eByP[e.trabalhoId] || 0) + 1
      })

      setProjects(p)
      setEvalsByProject(eByP)
    }catch(e:any){
      setError(e?.message || 'Erro ao carregar dados')
    }finally{
      setLoading(false)
    }
  },[])

  useEffect(()=>{ load() }, [load])

  // ----- Métricas -----
  const totals = useMemo(()=>{
    const totalProjects = projects.length
    const evaluated = projects.filter(p => (evalsByProject[p.id] || 0) > 0).length
    const notEvaluated = totalProjects - evaluated
    return { totalProjects, evaluated, notEvaluated }
  }, [projects, evalsByProject])

  const byCategory: Counts = useMemo(()=>{
    const out: Counts = {}
    projects.forEach(p => { out[p.categoria] = (out[p.categoria] || 0) + 1 })
    return sortCounts(out)
  }, [projects])

  const byCategoryEvaluated: Counts = useMemo(()=>{
    const out: Counts = {}
    projects.forEach(p => {
      const has = (evalsByProject[p.id] || 0) > 0
      if (has) out[p.categoria] = (out[p.categoria] || 0) + 1
    })
    return sortCounts(out)
  }, [projects, evalsByProject])

  const byTurma: Counts = useMemo(()=>{
    const out: Counts = {}
    projects.forEach(p => { out[p.turma || '—'] = (out[p.turma || '—'] || 0) + 1 })
    return sortCounts(out)
  }, [projects])

  const evalsHistogram: Counts = useMemo(()=>{
    // distribuição por quantidade de avaliações por projeto (0,1,2,3…)
    const out: Counts = {}
    projects.forEach(p=>{
      const n = evalsByProject[p.id] || 0
      const key = String(n)
      out[key] = (out[key] || 0) + 1
    })
    return sortCounts(out, numericAsc)
  }, [projects, evalsByProject])

  const pct = (n: number, total: number) => total ? (n / total) * 100 : 0
  const maxCount = (o: Counts) => Object.values(o).reduce((a,b)=>Math.max(a,b), 0)

  const exportCSV = () => {
    // Gera um CSV com os conjuntos principais (uma aba por seção — aqui concatenamos com cabeçalhos)
    const sec = (title: string, rows: string[]) => [title, ...rows, ''].join('\n')
    const s1 = sec('[Resumo]',
      ['total_projetos,avaliados,nao_avaliados',
       [totals.totalProjects, totals.evaluated, totals.notEvaluated].join(','),
      ])
    const s2 = sec('[Projetos por categoria]',
      [['categoria','qtde'].join(','), ...Object.entries(byCategory).map(([k,v])=>`${csv(k)},${v}`)]
    )
    const s3 = sec('[Avaliados por categoria]',
      [['categoria','qtde'].join(','), ...Object.entries(byCategoryEvaluated).map(([k,v])=>`${csv(k)},${v}`)]
    )
    const s4 = sec('[Projetos por turma]',
      [['turma','qtde'].join(','), ...Object.entries(byTurma).map(([k,v])=>`${csv(k)},${v}`)]
    )
    const s5 = sec('[Distribuição por nº de avaliações]',
      [['n_avaliacoes','qtde_projetos'].join(','), ...Object.entries(evalsHistogram).map(([k,v])=>`${k},${v}`)]
    )
    const blob = new Blob([ [s1,s2,s3,s4,s5].join('\n') ], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'charts-report.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} alignItems={{ xs:'stretch', sm:'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>📈 Gráficos & Estatísticas</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" onClick={load}>Recarregar</Button>
          <Button variant="contained" onClick={exportCSV} disabled={!projects.length}>Exportar CSV</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }}/>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="text.secondary">Projetos</Typography>
            <Typography variant="h4" fontWeight={800}>{totals.totalProjects}</Typography>
            <Stack mt={1} gap={0.5}>
              <TinyBar label="Avaliados" value={totals.evaluated} total={totals.totalProjects} color="#2e7d32" />
              <TinyBar label="Não avaliados" value={totals.notEvaluated} total={totals.totalProjects} color="#c62828" />
            </Stack>
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Projetos por categoria</Typography>
            <Bars data={byCategory} total={totals.totalProjects} highlightColor="#1565c0" />
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Avaliados por categoria</Typography>
            <Bars data={byCategoryEvaluated} total={totals.totalProjects} highlightColor="#2e7d32" />
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Projetos por turma</Typography>
            <Bars data={byTurma} total={totals.totalProjects} max={maxCount(byTurma)} wrapLabels />
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card><CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Distribuição por nº de avaliações</Typography>
            <Bars data={evalsHistogram} total={projects.length} fixedOrder numericKeys />
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  )
}

// ======= Components auxiliares (barras sem libs externas) =======

function TinyBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const w = total ? (value / total) * 100 : 0
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Chip size="small" label={label} />
      <Box sx={{ flex:1, height: 8, bgcolor:'#eee', borderRadius: 999, overflow:'hidden' }}>
        <Box sx={{ width: `${w}%`, height:'100%', bgcolor: color }} />
      </Box>
      <Typography variant="caption" sx={{ minWidth: 36, textAlign:'right' }}>{value}</Typography>
    </Stack>
  )
}

function Bars({
  data, total, max, highlightColor = '#1976d2', wrapLabels = false, fixedOrder = false, numericKeys = false
}: {
  data: Record<string, number>
  total: number
  max?: number
  highlightColor?: string
  wrapLabels?: boolean
  fixedOrder?: boolean
  numericKeys?: boolean
}) {
  const keys = Object.keys(data)
    .sort((a,b)=>{
      if (fixedOrder && numericKeys) return Number(a) - Number(b)
      if (fixedOrder) return 0
      return data[b] - data[a] // desc por valor
    })

  const denom = max ?? (keys.reduce((acc,k)=>Math.max(acc, data[k]), 0) || 1)

  return (
    <Stack gap={1}>
      {keys.length ? keys.map(k=>{
        const v = data[k]
        const pct = denom ? (v / denom) * 100 : 0
        return (
          <Stack key={k} direction="row" alignItems="center" gap={1}>
            <Tooltip title={`${v} (${((v/(total||1))*100).toFixed(1)}%)`}>
              <Box sx={{ flex:1, bgcolor:'#f2f5f9', borderRadius: 1, p: 1 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Box
                    sx={{
                      width: `${pct}%`,
                      height: 16,
                      bgcolor: highlightColor,
                      borderRadius: 1,
                      transition: 'width .2s ease',
                    }}
                  />
                  <Typography
                    variant="body2"
                    noWrap={!wrapLabels}
                    sx={{ minWidth: 0, flex: 1 }}
                  >
                    {k}
                  </Typography>
                  <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
                </Stack>
              </Box>
            </Tooltip>
          </Stack>
        )
      }) : (
        <Alert severity="info">Sem dados.</Alert>
      )}
    </Stack>
  )
}

// ======= helpers =======

function sortCounts(obj: Counts, cmp?: (a: string, b: string) => number): Counts {
  const entries = Object.entries(obj).sort((a,b)=>{
    if (cmp) return cmp(a[0], b[0])
    // padrão: alfabético
    return String(a[0]).localeCompare(String(b[0]))
  })
  return Object.fromEntries(entries)
}
function numericAsc(a: string, b: string){ return Number(a) - Number(b) }
function csv(s: string){ return `"${String(s).replace(/"/g,'""')}"` }
