// aggregator/src/server.ts
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { recomputeAll } from './worker'

const app = express()
const port = Number(process.env.PORT || 8787)

app.use(cors({ origin: true }))
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'fecipe-aggregator', version: 1 })
})

app.post('/recompute', async (req, res) => {
  try {
    const debug = String(req.query.debug ?? '') === '1'
    await recomputeAll({ debug })
    res.json({ ok: true })
  } catch (e: any) {
    console.error('[recompute] error', e)
    res.status(500).json({ ok: false, error: e?.message || 'internal' })
  }
})

app.listen(port, () => {
  console.log(`[aggregator] listening on http://localhost:${port}`)
  console.log('• POST /recompute  (use ?debug=1 para logs detalhados)')
})
