import { useState } from 'react'
import { Button, Stack, Alert } from '@mui/material'

const AGG_URL = import.meta.env.VITE_AGGREGATOR_URL?.replace(/\/+$/,'') // remove trailing slash
const AGG_TOKEN = import.meta.env.VITE_AGGREGATOR_TOKEN || ''

export default function RecomputeButton() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true); setMsg(null); setErr(null)

    try {
      if (!AGG_URL) throw new Error('URL do agregador não configurada (VITE_AGGREGATOR_URL).')

      // use debug=1 para ver logs detalhados no servidor
      const url = `${AGG_URL}/recompute?debug=1`

      const ctrl = new AbortController()
      const to = setTimeout(() => ctrl.abort(), 30_000) // 30s

      const headers: Record<string,string> = {
        'Content-Type': 'application/json',
      }
      // suporte a 2 estilos de auth
      if (AGG_TOKEN) {
        headers['Authorization'] = `Bearer ${AGG_TOKEN}`
        headers['X-Api-Key'] = AGG_TOKEN
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        mode: 'cors',
        signal: ctrl.signal,
      })
      clearTimeout(to)

      // tenta parsear json mesmo em erro
      let json: any = null
      try { json = await resp.json() } catch {}

      if (!resp.ok || !json?.ok) {
        const msg = json?.error || `HTTP ${resp.status} – verifique CORS/HTTPS/URL`
        throw new Error(msg)
      }

      setMsg('Notas recalculadas com sucesso.')
    } catch (e: any) {
      const m = e?.name === 'AbortError'
        ? 'Tempo excedido. O servidor do agregador não respondeu.'
        : (e?.message || 'Erro ao recalcular')
      setErr(m)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack spacing={1}>
      <Button onClick={handleClick} disabled={loading} variant="contained">
        {loading ? 'Recalculando…' : 'Recalcular notas agora'}
      </Button>
      {msg && <Alert severity="success">{msg}</Alert>}
      {err && <Alert severity="error">{err}</Alert>}
      {!AGG_URL && (
        <Alert severity="warning">
          Defina VITE_AGGREGATOR_URL no .env.local (ex.: https://aggregator.seudominio.com)
        </Alert>
      )}
    </Stack>
  )
}
