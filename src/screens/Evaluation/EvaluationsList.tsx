import { useEffect, useState } from 'react'
import { Box, Card, CardContent, CardActions, Typography, Button, LinearProgress, Alert, Stack } from '@mui/material'
import { useAuth } from '@contexts/AuthContext'
import { listMyEvaluations, getProjectTitle } from '@services/firestore/evaluator'
import { useNavigate } from 'react-router-dom'

export default function EvaluationsList(){
  const { user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<Array<{ id:string; trabalhoId:string; titulo:string; total:number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    let alive = true
    ;(async()=>{
      if(!user) return
      setLoading(true)
      const evals = await listMyEvaluations(user.uid)
      const list: Array<{ id:string; trabalhoId:string; titulo:string; total:number }> = []
      for (const e of evals){
        const notas = Object.values<number>(e.notas || {})
        const total = notas.reduce((a,b)=>a+b, 0)
        const titulo = await getProjectTitle(e.trabalhoId)
        list.push({ id:e.id, trabalhoId:e.trabalhoId, titulo, total })
      }
      if(alive) setItems(list)
      setLoading(false)
    })()
    return ()=>{ alive = false }
  }, [user])

  if (loading) return <LinearProgress/>

  if (!items.length){
    return (
      <Box p={3}>
        <Alert severity="info">Nenhuma avaliação realizada ainda.</Alert>
        <Button sx={{ mt:2 }} variant="outlined" onClick={()=>window.location.reload()}>Recarregar</Button>
      </Box>
    )
  }

  return (
    <Stack p={2} spacing={2}>
      {items.map(it=>(
        <Card key={it.id} variant="outlined">
          <CardContent>
            <Typography variant="h6" noWrap>{it.titulo}</Typography>
            <Typography variant="body2">Nota Total: {it.total.toFixed(2)}</Typography>
          </CardContent>
          <CardActions>
            <Button variant="contained"
              onClick={()=>nav(`/evaluator/evaluate/${it.trabalhoId}?evaluationId=${it.id}&titulo=${encodeURIComponent(it.titulo)}`)}>
              Editar
            </Button>
          </CardActions>
        </Card>
      ))}
    </Stack>
  )
}
