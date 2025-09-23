// src/screens/Admin/ReportsScreen.tsx
import { useCallback, useEffect, useState } from 'react'
import {
  Box, Grid, Card, CardContent, CardActions,
  Typography, Button, Stack, LinearProgress, Alert
} from '@mui/material'
import AssessmentIcon from '@mui/icons-material/Assessment'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import QueryStatsIcon from '@mui/icons-material/QueryStats'
import GroupsIcon from '@mui/icons-material/Groups'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useNavigate } from 'react-router-dom'

export default function ReportsScreen(){
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)
  const [totals, setTotals] = useState({
    projects: 0,
    evaluators: 0,
    evaluations: 0,
  })

  const load = useCallback(async ()=>{
    setLoading(true); setError(null)
    try{
      const [p,u,e] = await Promise.all([
        getDocs(collection(db,'trabalhos')),
        getDocs(collection(db,'users')),
        getDocs(collection(db,'avaliacoes')),
      ])
      const evaluators = u.docs.filter(d=>{
        const r = (d.data() as any).role
        return r === 'evaluator' || r === 'admin' || !r
      }).length
      setTotals({ projects: p.size, evaluators, evaluations: e.size })
    }catch(err:any){
      setError(err?.message || 'Erro ao carregar indicadores')
    }finally{
      setLoading(false)
    }
  },[])

  useEffect(()=>{ load() }, [load])

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} alignItems={{ xs:'stretch', sm:'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>📑 Relatórios</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" onClick={load}>Recarregar</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }}/>}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Projetos</Typography>
              <Typography variant="h4" fontWeight={800}>{totals.projects}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Avaliadores</Typography>
              <Typography variant="h4" fontWeight={800}>{totals.evaluators}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Avaliações</Typography>
              <Typography variant="h4" fontWeight={800}>{totals.evaluations}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height:'100%' }}>
            <CardContent>
              <Stack direction="row" gap={1} alignItems="center" mb={1}>
                <AssessmentIcon />
                <Typography variant="h6" fontWeight={700}>Relatório Geral</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Lista todos os projetos com nota final calculada e quantidade de avaliações.
              </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent:'flex-end' }}>
              <Button variant="contained" onClick={()=>nav('/admin/reports/general')}>
                Abrir
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height:'100%' }}>
            <CardContent>
              <Stack direction="row" gap={1} alignItems="center" mb={1}>
                <EmojiEventsIcon />
                <Typography variant="h6" fontWeight={700}>Top 3 por Categoria</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Ranking dos três melhores projetos por categoria (nota final normalizada).
              </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent:'flex-end' }}>
              <Button variant="contained" onClick={()=>nav('/admin/reports/winners')}>
                Abrir
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height:'100%' }}>
            <CardContent>
              <Stack direction="row" gap={1} alignItems="center" mb={1}>
                <QueryStatsIcon />
                <Typography variant="h6" fontWeight={700}>Gráficos & Estatísticas</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Distribuição por categoria, avaliados vs. não avaliados, aprovados/reprovados.
              </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent:'flex-end' }}>
              <Button variant="contained" onClick={()=>nav('/admin/reports/charts')}>
                Abrir
              </Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height:'100%' }}>
            <CardContent>
              <Stack direction="row" gap={1} alignItems="center" mb={1}>
                <GroupsIcon />
                <Typography variant="h6" fontWeight={700}>Desempenho dos Avaliadores</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Total de avaliações, média de notas e cobertura por categoria por avaliador.
              </Typography>
            </CardContent>
            <CardActions sx={{ justifyContent:'flex-end' }}>
              <Button variant="contained" onClick={()=>nav('/admin/reports/evaluators')}>
                Abrir
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
