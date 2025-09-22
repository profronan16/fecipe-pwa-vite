import { useCallback, useEffect, useState } from 'react'
import { Box, Card, CardContent, CardActions, Typography, Button, Stack, Avatar, LinearProgress, Alert, Fab } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { listEvaluators, deleteEvaluator } from '@services/firestore/evaluator'
import { useNavigate } from 'react-router-dom'

export default function EvaluatorsScreen(){
  const [rows, setRows] = useState<Array<{id:string; name:string; role:string}>>([])
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const load = useCallback(async ()=>{
    setLoading(true)
    try{ setRows(await listEvaluators()) }
    finally{ setLoading(false) }
  },[])

  useEffect(()=>{ load() },[load])

  return (
    <Box p={2} position="relative">
      {loading && <LinearProgress/>}
      {!loading && rows.length===0 && <Alert severity="info">Nenhum avaliador encontrado.</Alert>}

      <Stack spacing={2}>
        {rows.map(it=>(
          <Card key={it.id} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar>{(it.name||'?').charAt(0)}</Avatar>
                  <Box>
                    <Typography variant="subtitle1">{it.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {it.role==='admin' ? 'Administrador' : 'Avaliador'} — {it.id}
                    </Typography>
                  </Box>
                </Stack>
                <CardActions>
                  <Button onClick={()=>nav(`/admin/evaluators/${encodeURIComponent(it.id)}`)}>Editar</Button>
                  <Button color="error" onClick={async()=>{ await deleteEvaluator(it.id); load() }}>Excluir</Button>
                </CardActions>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Fab color="primary" sx={{ position:'fixed', right:24, bottom:24 }} onClick={()=>nav('/admin/evaluators/new')}>
        <AddIcon/>
      </Fab>
    </Box>
  )
}
