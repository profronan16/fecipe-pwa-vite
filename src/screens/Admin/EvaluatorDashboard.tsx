// src/screens/Evaluator/EvaluatorDashboard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box, Grid, Card, CardContent, CardActions,
  Typography, Button, Stack, LinearProgress, Alert
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useAuth } from '@contexts/AuthContext'

type Project = {
  id: string
  titulo: string
  categoria?: string
  turma?: string
}

type EvalDoc = {
  id: string
  trabalhoId: string
  createdAt?: any
  updatedAt?: any
  notas?: Record<string, number>
}

export default function EvaluatorDashboard(){
  const nav = useNavigate()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|null>(null)

  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [myEvals, setMyEvals] = useState<EvalDoc[]>([])
  const [projectTitleCache, setProjectTitleCache] = useState<Record<string,string>>({})

  const load = useCallback(async ()=>{
    if(!user) return
    setLoading(true); setError(null)
    try{
      // 1) todos os trabalhos
      const projSnap = await getDocs(collection(db, 'trabalhos'))
      const projects: Project[] = projSnap.docs.map(d => {
        const data = d.data() as any
        return { id: d.id, titulo: data.titulo || '—', categoria: data.categoria, turma: data.turma }
      })
      setAllProjects(projects)

      // 2) minhas avaliações
      const myEvalSnap = await getDocs(query(
        collection(db, 'avaliacoes'),
        where('avaliadorId', '==', user.uid)
      ))
      const evals: EvalDoc[] = myEvalSnap.docs.map(d => {
        const data = d.data() as any
        return { id: d.id, trabalhoId: data.trabalhoId, createdAt: data.createdAt, updatedAt: data.updatedAt, notas: data.notas }
      })
      setMyEvals(evals)

      // 3) cache de títulos para "recentes"
      const uniq = Array.from(new Set(evals.map(e => e.trabalhoId))).slice(0, 5)
      const cache: Record<string,string> = {}
      await Promise.all(uniq.map(async pid=>{
        if(!pid) return
        const s = await getDoc(doc(db, 'trabalhos', pid))
        if(s.exists()){
          cache[pid] = (s.data() as any).titulo || '—'
        }
      }))
      setProjectTitleCache(cache)
    }catch(e:any){
      setError(e?.message || 'Erro ao carregar dados')
    }finally{
      setLoading(false)
    }
  }, [user])

  useEffect(()=>{ load() }, [load])

  // ----- métricas -----
  const availableCount = useMemo(()=>{
    if(!user) return 0
    const done = new Set(myEvals.map(e=>e.trabalhoId))
    return allProjects.filter(p => !done.has(p.id)).length
  }, [allProjects, myEvals, user])

  const myEvaluationsCount = myEvals.length

  const recent = useMemo(()=>{
    // ordena por updatedAt/createdAt (quando disponível)
    const sortVal = (e: EvalDoc) => (e.updatedAt?.seconds || e.createdAt?.seconds || 0)
    return [...myEvals].sort((a,b)=> sortVal(b) - sortVal(a)).slice(0, 3)
  }, [myEvals])

  return (
    <Box p={2}>
      <Stack direction={{ xs:'column', sm:'row' }} gap={2} alignItems={{ xs:'stretch', sm:'center' }} mb={2}>
        <Typography variant="h5" fontWeight={800}>👋 Bem-vindo(a) ao Painel do Avaliador</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button variant="outlined" onClick={load}>Recarregar</Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ mb:2 }} />}
      {error && <Alert severity="error" sx={{ mb:2 }}>{error}</Alert>}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Trabalhos disponíveis</Typography>
              <Typography variant="h4" fontWeight={800}>{availableCount}</Typography>
              <Typography variant="body2" color="text.secondary">Ainda não avaliados por você</Typography>
            </CardContent>
            <CardActions sx={{ justifyContent:'flex-end' }}>
              <Button variant="contained" onClick={()=>nav('/evaluator/works')}>Ver trabalhos</Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Minhas avaliações</Typography>
              <Typography variant="h4" fontWeight={800}>{myEvaluationsCount}</Typography>
              <Typography variant="body2" color="text.secondary">Total já registradas</Typography>
            </CardContent>
            <CardActions sx={{ justifyContent:'flex-end' }}>
              <Button variant="contained" onClick={()=>nav('/evaluator/evaluations')}>Ver avaliações</Button>
            </CardActions>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">Minha conta</Typography>
              <Typography variant="h5" fontWeight={800} noWrap>{user?.displayName || user?.email}</Typography>
              <Typography variant="body2" color="text.secondary">Editar nome, senha e sair</Typography>
            </CardContent>
            <CardActions sx={{ justifyContent:'flex-end' }}>
              <Button variant="contained" onClick={()=>nav('/evaluator/profile')}>Abrir perfil</Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Comece por aqui</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap">
                <Button variant="contained" onClick={()=>nav('/evaluator/works')}>Escolher trabalho</Button>
                <Button variant="outlined" onClick={()=>nav('/evaluator/evaluations')}>Minhas avaliações</Button>
                <Button variant="outlined" onClick={()=>nav('/evaluator/profile')}>Perfil</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>Últimas avaliações</Typography>
              {!recent.length ? (
                <Alert severity="info">Você ainda não avaliou nenhum projeto.</Alert>
              ) : (
                <Stack gap={1}>
                  {recent.map((e)=>(
                    <Stack
                      key={e.id}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ p:1, borderRadius:1, bgcolor:'#f7f9fc' }}
                    >
                      <Box minWidth={0}>
                        <Typography variant="subtitle2" noWrap>
                          {projectTitleCache[e.trabalhoId] || 'Projeto'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {e.trabalhoId}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={()=>nav(`/evaluator/evaluate/${e.trabalhoId}?evaluationId=${e.id}`)}
                      >
                        Abrir
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
