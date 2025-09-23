// src/screens/Evaluation/EvaluationsList.tsx
import { useEffect, useState, useCallback } from 'react'
import {
  Box, Card, CardContent, CardActions,
  Typography, Button, LinearProgress, Alert, Stack
} from '@mui/material'
import { useAuth } from '@contexts/AuthContext'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '@services/firebase'
import { useNavigate } from 'react-router-dom'

type Item = {
  evaluationId: string
  trabalhoId: string
  titulo: string
  total: number
}

export default function EvaluationsList() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'avaliacoes'), where('avaliadorId', '==', user.uid))
      )

      const list: Item[] = []
      for (const d of snap.docs) {
        const data = d.data() as any
        const total = Object.values<number>(data.notas || {}).reduce((a, b) => a + b, 0)
        const proj = await getDoc(doc(db, 'trabalhos', data.trabalhoId))
        const titulo = proj.exists() ? ((proj.data() as any).titulo || '—') : '—'
        list.push({
          evaluationId: d.id,
          trabalhoId: data.trabalhoId,
          titulo,
          total,
        })
      }
      setItems(list)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  if (loading) return <LinearProgress />

  if (!items.length) {
    return (
      <Box p={3}>
        <Alert severity="info">Nenhuma avaliação realizada ainda.</Alert>
        <Button sx={{ mt: 2 }} variant="outlined" onClick={load}>
          Recarregar
        </Button>
      </Box>
    )
  }

  return (
    <Stack p={2} spacing={2}>
      {items.map((it) => (
        <Card key={it.evaluationId} variant="outlined">
          <CardContent>
            <Typography variant="h6" noWrap>{it.titulo}</Typography>
            <Typography variant="body2">Nota Total: {it.total.toFixed(2)}</Typography>
          </CardContent>
          <CardActions>
            <Button
              variant="contained"
              onClick={() =>
                nav(
                  `/evaluator/evaluate/${it.trabalhoId}?evaluationId=${it.evaluationId}&titulo=${encodeURIComponent(it.titulo)}`
                )
              }
            >
              Editar
            </Button>
          </CardActions>
        </Card>
      ))}
    </Stack>
  )
}
