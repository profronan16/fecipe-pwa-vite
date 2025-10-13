// aggregator/src/server.ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { recomputeAll } from './worker.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = Number(process.env.PORT || 8787)
const TOKEN = process.env.AGGREGATOR_TOKEN || ''  // defina um token secreto

app.post('/recompute', async (req, res) => {
  try {
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!TOKEN || token !== TOKEN) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }

    await recomputeAll()
    res.json({ ok: true })
  } catch (e: any) {
    console.error('[aggregator] /recompute error', e)
    res.status(500).json({ ok: false, error: e?.message || 'internal_error' })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`[aggregator] server listening on :${PORT}`)
})
