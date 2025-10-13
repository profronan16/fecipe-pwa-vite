// aggregator/src/server.ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { recomputeAll } from './worker.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const TOKEN = process.env.AGGREGATOR_TOKEN || ''

function authorized(req: express.Request): boolean {
  const auth = req.headers.authorization || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const q = (req.query?.token as string) || ''
  if (!TOKEN) return true // se não definir TOKEN, não exige auth (somente dev!)
  return bearer === TOKEN || q === TOKEN
}

app.get('/health', (_req, res) => res.json({ ok: true }))

// POST (produção) — recomendado
app.post('/recompute', async (req, res) => {
  try {
    if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
    await recomputeAll()
    res.json({ ok: true })
  } catch (e: any) {
    console.error('[aggregator] /recompute error', e)
    res.status(500).json({ ok: false, error: e?.message || 'internal_error' })
  }
})

// GET (dev) — permite testar no navegador: http://localhost:8787/recompute?token=XYZ
app.get('/recompute', async (req, res) => {
  try {
    if (!authorized(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
    await recomputeAll()
    res.json({ ok: true })
  } catch (e: any) {
    console.error('[aggregator] /recompute GET error', e)
    res.status(500).json({ ok: false, error: e?.message || 'internal_error' })
  }
})

app.listen(PORT, HOST, () => {
  console.log(`[aggregator] server listening on http://${HOST}:${PORT}`)
})
