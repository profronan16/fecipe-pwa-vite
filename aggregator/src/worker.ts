// aggregator/src/worker.ts
import 'dotenv/config'
import admin from 'firebase-admin'
import { RUBRICS, rubricIdForProject } from './rubrics.js'

const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
})
const db = admin.firestore()

type Scores = Record<string, number>

function stdFromSums(sum: number, sumsq: number, n: number): number {
  if (n <= 0) return 0
  const mu = sum / n
  const variance = (sumsq / n) - mu * mu
  return Math.sqrt(Math.max(0, variance))
}

/** Executa o recálculo completo (NaCi, MCi/σCi, NCi, NF) para TODOS os trabalhos. */
export async function recomputeAll() {
  const z = 2.5
  console.time('[aggregator] recomputeAll')

  // 1) Ler todos os trabalhos
  const worksSnap = await db.collection('trabalhos').get()
  const works = worksSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))

  // 2) Para cada trabalho, calcular NaCi (média dos avaliadores por critério)
  const workNa: Record<string, Scores> = {}
  const workRubric: Record<string, string> = {}

  for (const w of works) {
    const workId = w.id as string
    const rubricId = w.rubricId || rubricIdForProject(w.categoria, w.subcategoria)
    workRubric[workId] = rubricId

    const evals = await db.collection('avaliacoes').where('trabalhoId', '==', workId).get()
    const sum: Scores = {}
    const cnt: Record<string, number> = {}

    for (const e of evals.docs) {
      const data = e.data() as any
      const src: Record<string, unknown> = data.scores ?? data.notas ?? {}
      for (const [cId, v] of Object.entries(src)) {
        const num = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
        if (!Number.isFinite(num)) continue
        sum[cId] = (sum[cId] ?? 0) + num
        cnt[cId] = (cnt[cId] ?? 0) + 1
      }
    }

    const meanByCriterion: Scores = {}
    for (const [cId, s] of Object.entries(sum)) {
      meanByCriterion[cId] = s / (cnt[cId] || 1)
    }
    workNa[workId] = meanByCriterion

    await db.collection('workAggregates').doc(workId).set({
      workId,
      rubricId,
      meanByCriterion,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  // 3) Agregar por rubrica/critério para MCi e σCi
  const acc: Record<string, Record<string, { count: number; sum: number; sumsq: number }>> = {}

  for (const [workId, Na] of Object.entries(workNa)) {
    const rubricId = workRubric[workId]
    if (!acc[rubricId]) acc[rubricId] = {}
    for (const [cId, NaCi] of Object.entries(Na)) {
      const a = (acc[rubricId][cId] ||= { count: 0, sum: 0, sumsq: 0 })
      a.count += 1
      a.sum += NaCi
      a.sumsq += NaCi * NaCi
    }
  }

  // 3.1) Persistir rubricStats
  for (const [rubricId, byCrit] of Object.entries(acc)) {
    const batch = db.batch()
    for (const [cId, a] of Object.entries(byCrit)) {
      const mean = a.count > 0 ? (a.sum / a.count) : 0
      const std = stdFromSums(a.sum, a.sumsq, a.count)
      const ref = db.collection('rubricStats').doc(rubricId).collection('criteria').doc(cId)
      batch.set(ref, {
        rubricId, criterionId: cId,
        count: a.count, sum: a.sum, sumsq: a.sumsq,
        mean, std,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    await batch.commit()
  }

  // 4) Calcular NCi e NF por trabalho
  for (const w of works) {
    const workId = w.id as string
    const rubricId = workRubric[workId]
    const Na = workNa[workId] || {}
    const rubric = RUBRICS[rubricId] || RUBRICS['comoral']

    const statsSnap = await db.collection('rubricStats').doc(rubricId).collection('criteria').get()
    const stats = new Map(statsSnap.docs.map(d => [d.id, d.data() as any]))

    const nci: Scores = {}
    let nf = 0
    for (const cId of rubric.criteria) {
      const NaCi = Na[cId]
      if (typeof NaCi !== 'number') continue
      const MCi = stats.get(cId)?.mean ?? 0
      const sigma = stats.get(cId)?.std ?? 0
      const NCi = sigma > 0 ? ((NaCi - MCi) / sigma) + z : z
      nci[cId] = NCi
      const w = rubric.weights[cId] ?? 1
      nf += NCi * w
    }

    await db.collection('workAggregates').doc(workId).set({
      nci,
      nf,
      nfUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }

  console.timeEnd('[aggregator] recomputeAll')
}

/** CLI: permite rodar `npm run recompute` para executar uma vez e sair. */
if (process.argv.includes('--once')) {
  recomputeAll().then(() => {
    console.log('[aggregator] done.')
    process.exit(0)
  }).catch(err => {
    console.error('[aggregator] error:', err)
    process.exit(1)
  })
}
