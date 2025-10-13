import { useState } from 'react'
import { Button, Stack, Alert } from '@mui/material'

export default function RecomputeButton() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true); setMsg(null); setErr(null)
    try {
      const url = `${import.meta.env.VITE_AGGREGATOR_URL}/recompute`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${import.meta.env.VITE_AGGREGATOR_TOKEN}` }
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) throw new Error(json?.error || 'Falha ao recalcular')
      setMsg('Notas recalculadas com sucesso.')
    } catch (e: any) {
      setErr(e?.message || 'Erro ao recalcular')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack spacing={1}>
      <Button onClick={handleClick} disabled={loading} variant="contained">
        {loading ? 'Recalculando...' : 'Recalcular notas agora'}
      </Button>
      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}
    </Stack>
  )
}
