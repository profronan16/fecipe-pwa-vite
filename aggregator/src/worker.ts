// aggregator/src/worker.ts
import 'dotenv/config'
import { initializeApp } from 'firebase/app'
import {
  collection, getDocs, getFirestore, query, where, doc, setDoc,
} from 'firebase/firestore'
import { RUBRICS, resolveRubricIdFromWork, Rubric, CriterionId } from './rubrics'

const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY!,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.FIREBASE_PROJECT_ID!,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  appId: process.env.FIREBASE_APP_ID!,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
})
const db = getFirestore(app)

// ---------------- utils ----------------
const EPS = 1e-9
const round = (n: number, p = 6) => Math.round(n * 10 ** p) / 10 ** p
const isDbg = () =>
  process.env.DEBUG_AGG_LOG === '1' ||
  process.argv.includes('--debug') ||
  process.argv.includes('-d')
const dlog = (...a: any[]) => { if (isDbg()) console.log(...a) }
const dheader = (t: string) => { if (isDbg()) console.log(`\n================ ${t} ================`) }
const dtable = (label: string, rows: any[]) => { if (isDbg()) { console.log(`\n${label}`); console.table(rows) } }

function parseMaybeNumber(v: any): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const s = v.replace(',', '.').trim()
    const n = Number(s)
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

function stdPopulation(values: number[]): number {
  const vals = values.filter(v => Number.isFinite(v))
  if (!vals.length) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / vals.length
  return Math.sqrt(variance)
}

// ---------------- tipos ----------------
type EvalDoc = {
  trabalhoId: string
  avaliadorId: string
  criterios?: Array<{ id?: string; value?: any; [k: string]: any }>
  notas?: any
  scores?: any
  [k: string]: any
}
type Work = {
  id: string
  titulo?: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
}

// --------- parsing: mapeia avaliação → { C1: num, C2: num, ... } ----------
function mapScoresFromEvaluation(e: EvalDoc, criteriaLen: number): Record<CriterionId, number> {
  const out: Record<CriterionId, number> = {}
  for (let i = 1; i <= criteriaLen; i++) out[`C${i}` as CriterionId] = 0

  // formato “oficial” do seu banco: criterios: [{id:'c1', value:1.5}, ...]
  if (Array.isArray(e.criterios) && e.criterios.length) {
    for (const item of e.criterios) {
      const idRaw = String(item?.id ?? '').trim().toLowerCase() // 'c1'
      const val = parseMaybeNumber(item?.value)
      const m = idRaw.match(/^c(\d+)$/)
      if (m && Number(m[1]) >= 1) {
        const key = `C${Number(m[1])}` as CriterionId
        if (Number.isFinite(val)) out[key] = val
      }
    }
  }

  // compat: objetos soltos (notas/scores/e)
  const bags = [e.notas, e.scores, e]
  for (const bag of bags) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) continue
    for (let i = 1; i <= criteriaLen; i++) {
      const key = `C${i}` as CriterionId
      if (out[key] !== 0) continue
      const aliases = [
        `C${i}`, `c${i}`, `${i}`,
        `criterio${i}`, `crit${i}`, `nota${i}`,
        `criterio_${i}`, `crit_${i}`, `nota_${i}`,
      ]
      for (const a of aliases) {
        if (a in bag) {
          const n = parseMaybeNumber(bag[a])
          if (Number.isFinite(n)) { out[key] = n; break }
        }
      }
    }
  }

  return out
}

// ---------------- pipeline ----------------
export async function recomputeAll(opts?: { debug?: boolean }) {
  if (opts?.debug) process.env.DEBUG_AGG_LOG = '1'

  // 1) trabalhos
  const trabSnap = await getDocs(collection(db, 'trabalhos'))
  const works: Work[] = trabSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

  // 2) agrupar por rúbrica
  const byRubric = new Map<string, { rubric: Rubric; works: Work[] }>()
  for (const w of works) {
    const r = resolveRubricIdFromWork(w)
    if (!byRubric.has(r.id)) byRubric.set(r.id, { rubric: r, works: [] })
    byRubric.get(r.id)!.works.push(w)
  }

  for (const [rubricId, group] of byRubric) {
    dheader(`RÚBRICA ${rubricId} — ${group.rubric.label}`)
    await recomputeGroup(group.rubric, group.works)
  }

  dlog('\nOK: recompute finalizado.')
}

async function recomputeGroup(rubric: Rubric, works: Work[]) {
  if (!works.length) return
  const k = rubric.criteria.length

  // (A) médias por TRABALHO/critério (NaCi)
  const NaCByWork = new Map<string, Record<CriterionId, number>>()

  // (B) base global por critério com TODAS as notas individuais (para MCi/σi)
  const allScoresByCriterion: Record<CriterionId, number[]> =
    Object.fromEntries(rubric.criteria.map(c => [c, []])) as any

  for (const w of works) {
    const qEval = query(collection(db, 'avaliacoes'), where('trabalhoId', '==', w.id))
    const snap = await getDocs(qEval)

    const sum: Record<CriterionId, number> = Object.fromEntries(rubric.criteria.map(c => [c, 0])) as any
    const cnt: Record<CriterionId, number> = Object.fromEntries(rubric.criteria.map(c => [c, 0])) as any

    let evalCount = 0
    for (const d of snap.docs) {
      const e = d.data() as EvalDoc
      const m = mapScoresFromEvaluation(e, k)

      if (isDbg()) {
        const seen = rubric.criteria.map(c => `${c}=${m[c]}`)
        dlog(` • eval ${d.id} →`, seen.join(', '))
      }

      // acumula para NaCi (por trabalho)
      for (const c of rubric.criteria) {
        const v = Number(m[c] ?? 0)
        if (Number.isFinite(v)) { sum[c] += v; cnt[c] += 1 }
      }

      // acumula notas individuais para base GLOBAL (MCi/σi)
      for (const c of rubric.criteria) {
        const v = Number(m[c] ?? 0)
        if (Number.isFinite(v)) allScoresByCriterion[c].push(v)
      }

      evalCount++
    }

    const mean: Record<CriterionId, number> = {} as any
    for (const c of rubric.criteria) mean[c] = cnt[c] ? sum[c] / cnt[c] : 0
    NaCByWork.set(w.id, mean)

    dlog(`Trabalho ${w.id} (${w.titulo || '—'}) — avaliações: ${evalCount}`)
    dtable('NaCi (média por critério)', rubric.criteria.map(c => ({ criterio: c, NaCi: round(mean[c], 6) })))
  }

  // (C) MCi e σi sobre TODAS as notas individuais (não sobre NaCi)
  const MCi: Record<CriterionId, number> = {} as any
  const SDi: Record<CriterionId, number> = {} as any

  for (const c of rubric.criteria) {
    const arr = allScoresByCriterion[c] || []
    const mean = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    const sd = stdPopulation(arr)
    MCi[c] = mean
    SDi[c] = sd
  }

  if (isDbg()) {
    dtable('Base global (contagem por critério)', rubric.criteria.map(c => ({
      criterio: c, n: (allScoresByCriterion[c] || []).length,
    })))
    dtable('MCi (média global por critério — todas as notas)', rubric.criteria.map(c => ({ criterio: c, MCi: round(MCi[c], 6) })))
    dtable('σi (desvio padrão populacional — todas as notas)', rubric.criteria.map(c => ({ criterio: c, sigma: round(SDi[c], 11) })))
  }

  // (D) NCi e NF por trabalho
  for (const w of works) {
    const NaC = NaCByWork.get(w.id) || {}
    const NCi: Record<CriterionId, number> = {} as any
    const contrib: Record<CriterionId, number> = {} as any
    let NF = 0

    for (const c of rubric.criteria) {
      const nac = NaC[c] ?? 0
      const mc = MCi[c] ?? 0
      const sd = SDi[c] ?? 0
      const nci = ((nac - mc) / (sd || EPS)) + rubric.z
      const part = nci * (rubric.weights[c] ?? 0)
      NCi[c] = nci
      contrib[c] = part
      NF += part
    }

    dheader(`WORK ${w.id} — ${w.titulo || '—'}`)
    dtable('Entradas (NaCi / MCi / σi / peso)', rubric.criteria.map(c => ({
      criterio: c,
      NaCi: round(NaC[c] ?? 0, 6),
      MCi: round(MCi[c] ?? 0, 6),
      sigma: round(SDi[c] ?? 0, 11),
      peso: rubric.weights[c],
    })))
    dtable('NCi e contribuição (NCi * peso)', rubric.criteria.map(c => ({
      criterio: c,
      NCi: round(NCi[c], 6),
      contrib: round(contrib[c], 6),
    })))
    dlog('NF =', round(NF, 6))

    await setDoc(doc(db, 'workAggregates', w.id), {
      workId: w.id,
      rubricId: rubric.id,
      meanByCriterion: NaC,   // NaCi por trabalho
      meanGlobal: MCi,        // média global por critério (todas as notas)
      stdGlobal: SDi,         // σ global por critério (todas as notas)
      nci: NCi,
      nf: NF,
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  }
}

// CLI
if (process.argv.includes('--once')) {
  recomputeAll({ debug: isDbg() })
    .then(() => { if (isDbg()) console.log('OK') })
    .catch((e) => { console.error(e); process.exit(1) })
}
