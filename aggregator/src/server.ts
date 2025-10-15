import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { recomputeAll } from './worker'

// Carrega .env.* conforme NODE_ENV (development/production/test)
import dotenv from 'dotenv'
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'test'
    ? '.env.test'
    : '.env.development'
dotenv.config({ path: envFile })

// --------- ENV ----------
const PORT = Number(process.env.PORT || 8787)
const TOKEN = (process.env.AGGREGATOR_TOKEN || '').trim()

// CORS: lista separada por vírgula
// Ex.: http://localhost:5173,https://ifcoding.com.br
const ORIGINS = (process.env.AGG_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

// como fallback, se não houver AGG_ALLOWED_ORIGINS, libera a própria origem padrão
if (!ORIGINS.length && process.env.APP_ORIGIN) {
  ORIGINS.push(process.env.APP_ORIGIN)
}

// --------- APP ----------
const app = express()

app.use(helmet({
  contentSecurityPolicy: false,
}))

app.use(cors({
  origin: (origin, cb) => {
    // requisições sem Origin (curl, health checks) -> permite
    if (!origin) return cb(null, true)
    if (ORIGINS.includes(origin)) return cb(null, true)
    return cb(new Error(`Origin not allowed by CORS: ${origin}`))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
}))

app.use(express.json())
app.use(morgan('tiny'))

// Auth simples por token (header Authorization: Bearer <token> ou X-Api-Key: <token>)
function requireToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!TOKEN) return res.status(500).json({ error: 'Missing AGGREGATOR_TOKEN on server' })
  const h = req.header('authorization') || ''
  const key = req.header('x-api-key') || ''
  const candidate = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : key.trim()
  if (candidate && candidate === TOKEN) return next()
  return res.status(401).json({ error: 'unauthorized' })
}

// Healthcheck
app.get('/healthz', (_req, res) => {
  res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    port: PORT,
    allow: ORIGINS,
  })
})

// Recompute (POST). Use ?debug=1 para logs detalhados no console
app.post('/recompute', requireToken, async (req, res) => {
  try {
    const debug = String(req.query.debug || '').trim() === '1'
    if (debug) process.env.DEBUG_AGG_LOG = '1'
    await recomputeAll(debug)
    res.json({ ok: true })
  } catch (err: any) {
    console.error('[recompute] error:', err)
    res.status(500).json({ ok: false, error: String(err?.message || err) })
  }
})

// 404 padrão
app.use((_req, res) => {
  res.status(404).send('Not Found')
})

app.listen(PORT, () => {
  console.log(`[aggregator] listening on http://localhost:${PORT}`)
  console.log('• POST /recompute  (use ?debug=1 para logs)')
})
