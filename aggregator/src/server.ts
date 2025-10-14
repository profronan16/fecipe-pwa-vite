// aggregator/src/server.ts
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { recomputeAll } from './worker'

// Firebase Admin
import admin from 'firebase-admin'

// inicializa Admin se ainda não
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })
  }
} catch {}

const app = express()
const PORT = Number(process.env.PORT || 8787)

const allowed = (process.env.APP_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

app.use((_, res, next) => {
  res.setHeader('Vary', 'Origin')
  next()
})

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, false)
    if (allowed.includes(origin)) return cb(null, origin)
    return cb(null, false)
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  optionsSuccessStatus: 204,
}))

app.use(bodyParser.json({ limit: '2mb' }))

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now(), origins: allowed })
})

app.post('/recompute', async (req, res) => {
  try {
    const token = process.env.AGGREGATOR_TOKEN
    const auth = req.get('Authorization') || req.get('X-Api-Key') || ''
    if (token && !auth.includes(String(token))) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }
    const debug = String(req.query.debug || '') === '1'
    await recomputeAll({ debug })
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'error' })
  }
})

/**
 * Admin: criar avaliadores em lote
 * body: { evaluators: Array<{ name: string; email: string; password: string }> }
 */
app.post('/admin/evaluators/bulk', async (req, res) => {
  try {
    const token = process.env.AGGREGATOR_TOKEN
    const auth = req.get('Authorization') || req.get('X-Api-Key') || ''
    if (token && !auth.includes(String(token))) {
      return res.status(401).json({ ok: false, error: 'unauthorized' })
    }

    const items = Array.isArray(req.body?.evaluators) ? req.body.evaluators : []
    if (!items.length) return res.status(400).json({ ok: false, error: 'missing evaluators' })

    const results: Array<{ email: string; uid?: string; error?: string }> = []

    for (const row of items) {
      const name = String(row.name || '').trim()
      const email = String(row.email || '').trim().toLowerCase()
      const password = String(row.password || '').trim()

      if (!name || !email || password.length < 6) {
        results.push({ email, error: 'invalid row' })
        continue
      }

      try {
        // cria usuário no Auth
        const user = await admin.auth().createUser({
          email, password, displayName: name, disabled: false,
        })

        // grava perfil em /profiles/{uid}
        const db = admin.firestore()
        await db.collection('profiles').doc(user.uid).set({
          uid: user.uid,
          displayName: name,
          email,
          role: 'evaluator',
          active: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })

        // opcional: índice por e-mail em /users (mantendo seu padrão)
        await db.collection('users').doc(email).set({
          email, name, role: 'evaluator', active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true })

        results.push({ email, uid: user.uid })
      } catch (err: any) {
        results.push({ email, error: err?.message || 'createUser failed' })
      }
    }

    res.json({ ok: true, results })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || 'error' })
  }
})

app.listen(PORT, () => {
  console.log(`[aggregator] listening on http://localhost:${PORT}`)
  console.log(`• POST /recompute  (use ?debug=1)`)
  console.log(`• POST /admin/evaluators/bulk  (auth via AGGREGATOR_TOKEN)`)
})
