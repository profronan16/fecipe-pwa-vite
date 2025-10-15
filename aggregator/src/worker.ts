// aggregator/src/worker.ts
// -----------------------------------------------------------------------------
// Recomputador de notas finais e estatísticas de rúbricas.
// Usa @google-cloud/firestore (GOOGLE_APPLICATION_CREDENTIALS).
// -----------------------------------------------------------------------------

import { Firestore, Timestamp } from '@google-cloud/firestore'
import { criteriaFor, resolveRubricId, rubricTitle, weightsFor, type CriterionId, type RubricId } from './rubrics'
import { fileURLToPath } from 'url';

const firestore = new Firestore()

const Z = 2.5 // constante de escala
const DEBUG = process.env.DEBUG_AGG_LOG === '1' || process.argv.includes('--debug')

type WorkDoc = {
  id: string
  titulo?: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
}

type EvaluationDoc = {
  id: string
  trabalhoId: string
  avaliadorId: string
  criterios?: Array<{ id: string; value: number | null }>
  notas?: Record<string, number | null>
}

// ------------------------ util numérica ------------------------

function safeNum(x: any, def = 0): number {
  const n = Number(x)
  return Number.isFinite(n) ? n : def
}

function popStd(values: number[]): number {
  if (!values.length) return 0
  const mean = values.reduce((a,b)=>a+b,0) / values.length
  const varPop = values.reduce((a,b)=>a + (b-mean)*(b-mean), 0) / values.length
  return Math.sqrt(varPop)
}

// ------------------------ leitura Firestore ------------------------

async function listWorks(): Promise<WorkDoc[]> {
  const snap = await firestore.collection('trabalhos').get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

async function listEvaluationsByWork(workId: string): Promise<EvaluationDoc[]> {
  const snap = await firestore.collection('avaliacoes')
    .where('trabalhoId', '==', workId)
    .get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

// ------------------------ núcleo do cálculo ------------------------

type PerCriterion = Record<CriterionId, number>
type MaybePerCriterion = Partial<PerCriterion>

function emptyPerCriterion(criteria: CriterionId[]): PerCriterion {
  const o: any = {}
  for (const c of criteria) o[c] = 0
  return o
}

function addInto(target: MaybePerCriterion, criteria: CriterionId[], add: MaybePerCriterion) {
  for (const c of criteria) {
    target[c] = safeNum(target[c]) + safeNum(add[c])
  }
}

function fromEvaluationToPerCriterion(ev: EvaluationDoc, criteria: CriterionId[]): MaybePerCriterion {
  const out: MaybePerCriterion = {}
  if (Array.isArray(ev.criterios) && ev.criterios.length) {
    for (const it of ev.criterios) {
      const id = String(it.id || '').toUpperCase() as CriterionId
      if (criteria.includes(id)) out[id] = safeNum(it.value, 0)
    }
  } else if (ev.notas && typeof ev.notas === 'object') {
    for (const [k,v] of Object.entries(ev.notas)) {
      const id = String(k).toUpperCase() as CriterionId
      if (criteria.includes(id)) out[id] = safeNum(v, 0)
    }
  }
  return out
}

function divInto(target: MaybePerCriterion, criteria: CriterionId[], divisor: number): PerCriterion {
  const out: any = {}
  for (const c of criteria) out[c] = divisor ? safeNum(target[c]) / divisor : 0
  return out as PerCriterion
}

// ✅ correção: função genérica sem restringir T a number
function mapPerCriterion<T>(criteria: CriterionId[], fn: (c: CriterionId)=>T): Record<CriterionId, T> {
  const o: any = {}
  for (const c of criteria) o[c] = fn(c)
  return o
}

// ------------------------ persistência ------------------------

async function saveRubricStats(rubricId: RubricId, stats: {
  count: Record<CriterionId, number>
  sum:   Record<CriterionId, number>
  sumsq: Record<CriterionId, number>
  mean:  Record<CriterionId, number>
  std:   Record<CriterionId, number>
}) {
  const headRef = firestore.doc(`rubricStats/${rubricId}`)
  await headRef.set({ rubricId, updatedAt: Timestamp.fromDate(new Date()) }, { merge: true })

  for (const c of Object.keys(stats.mean) as CriterionId[]) {
    const ref = firestore.doc(`rubricStats/${rubricId}/criteria/${c.toLowerCase()}`)
    await ref.set({
      rubricId,
      criterionId: c.toLowerCase(),
      count: stats.count[c],
      sum:   Number(stats.sum[c].toFixed(12)),
      sumsq: Number(stats.sumsq[c].toFixed(12)),
      mean:  Number(stats.mean[c].toFixed(12)),
      std:   Number(stats.std[c].toFixed(12)),
      updatedAt: Timestamp.fromDate(new Date()),
    }, { merge: true })
  }
}

async function saveWorkAggregate(workId: string, data: {
  rubricId: RubricId
  meanByCriterion: Record<CriterionId, number>   // NaCi
  meanGlobal: Record<CriterionId, number>        // MCi
  sigma: Record<CriterionId, number>             // σi
  nci: Record<CriterionId, number>               // NCi
  final: number
}) {
  const ref = firestore.doc(`workAggregates/${workId}`)
  await ref.set({
    ...data,
    updatedAt: Timestamp.fromDate(new Date()),
  }, { merge: true })

  await firestore.doc(`trabalhos/${workId}`).set({
    finalScore: Number(data.final.toFixed(4)),
    rubricId: data.rubricId,
    aggregatesUpdatedAt: Timestamp.fromDate(new Date())
  }, { merge: true })
}

// ------------------------ processo por rúbrica ------------------------

async function processGroup(rubricId: RubricId, works: WorkDoc[]) {
  if (!works.length) return
  const criteria = criteriaFor(rubricId)
  const weights = weightsFor(rubricId)

  DEBUG && console.log(`\n================ RÚBRICA ${rubricId} — ${rubricTitle(rubricId)} ================`)

  // 1) NaCi por trabalho
  const NaCi_by_work: Record<string, PerCriterion> = {}
  for (const w of works) {
    const evals = await listEvaluationsByWork(w.id)
    const sum: MaybePerCriterion = {}
    let count = 0
    for (const ev of evals) {
      const pc = fromEvaluationToPerCriterion(ev, criteria)
      if (Object.keys(pc).length) {
        addInto(sum, criteria, pc)
        count++
      }
    }
    NaCi_by_work[w.id] = divInto(sum, criteria, count || 1)

    DEBUG && console.table([
      { label: `Trabalho ${w.id} (${w.titulo || ''}) — avaliações`, value: evals.length }
    ])
    DEBUG && console.table(
      criteria.map(c => ({ criterio: c, NaCi: Number(NaCi_by_work[w.id][c].toFixed(6)) }))
    )
  }

  // 2) MCi e σi globais
  const NaCisArray: Record<CriterionId, number[]> = mapPerCriterion(criteria, () => [])
  for (const w of works) {
    const nac = NaCi_by_work[w.id]
    for (const c of criteria) NaCisArray[c].push(safeNum(nac[c]))
  }

  const MCi: Record<CriterionId, number> = mapPerCriterion(criteria, c => {
    const arr = NaCisArray[c]; return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0
  })
  const sigma: Record<CriterionId, number> = mapPerCriterion(criteria, c => popStd(NaCisArray[c]))

  DEBUG && console.log('\nMCi (média global por critério no grupo)')
  DEBUG && console.table(criteria.map(c => ({ criterio: c, MCi: Number(MCi[c].toFixed(6)) })))
  DEBUG && console.log('\nσi (desvio padrão global por critério no grupo)')
  DEBUG && console.table(criteria.map(c => ({ criterio: c, sigma: Number(sigma[c].toFixed(6)) })))

  // 3) NCi e NF por trabalho
  for (const w of works) {
    const nac = NaCi_by_work[w.id]
    const nci: Record<CriterionId, number> = mapPerCriterion(criteria, c => {
      const sd = sigma[c]
      const base = sd > 0 ? (nac[c] - MCi[c]) / sd : 0
      return base + Z
    })
    const contribs = criteria.map(c => ({ c, NCi: nci[c], contrib: nci[c] * (weights[c] || 0) }))
    const finalScore = contribs.reduce((a, it) => a + it.contrib, 0)

    if (DEBUG) {
      console.log(`\n================ WORK ${w.id} — ${w.titulo || ''} ================`)
      console.log('\nEntradas (NaCi / MCi / σi / peso)')
      console.table(criteria.map(c => ({
        criterio: c,
        NaCi: Number(nac[c].toFixed(6)),
        MCi: Number(MCi[c].toFixed(6)),
        sigma: Number(sigma[c].toFixed(6)),
        peso: weights[c] || 0
      })))
      console.log('\nNCi e contribuição (NCi * peso)')
      console.table(contribs.map(it => ({
        criterio: it.c,
        NCi: Number(it.NCi.toFixed(6)),
        contrib: Number(it.contrib.toFixed(6))
      })))
      console.log(`NF = ${Number(finalScore.toFixed(6))}\n`)
    }

    await saveWorkAggregate(w.id, {
      rubricId,
      meanByCriterion: nac,
      meanGlobal: MCi,
      sigma,
      nci,
      final: finalScore
    })
  }

  // 4) Estatísticas globais da rúbrica
  const count: Record<CriterionId, number> = mapPerCriterion(criteria, c => NaCisArray[c].length)
  const sum:   Record<CriterionId, number> = mapPerCriterion(criteria, c => NaCisArray[c].reduce((a,b)=>a+b,0))
  const sumsq: Record<CriterionId, number> = mapPerCriterion(criteria, c => NaCisArray[c].reduce((a,b)=>a+b*b,0))
  await saveRubricStats(rubricId, { count, sum, sumsq, mean: MCi, std: sigma })
}

// ------------------------ orquestração ------------------------

export async function recomputeAll(debug = false) {
  const allWorks = await listWorks()
  if (!allWorks.length) {
    if (debug || DEBUG) console.log('[aggregator] Nenhum trabalho encontrado.')
    return
  }

  const groups: Record<RubricId, WorkDoc[]> = {
    'iftech': [], 'feira': [], 'comoral': [],
    'banner-ensino': [], 'banner-extensao': [], 'banner-pesquisa': []
  }
  for (const w of allWorks) {
    const rid = resolveRubricId({ categoria: w.categoria, subcategoria: w.subcategoria })
    groups[rid].push(w)
  }

  for (const [rid, list] of Object.entries(groups) as [RubricId, WorkDoc[]][]) {
    if (!list.length) continue
    await processGroup(rid, list)
  }

  if (debug || DEBUG) console.log('OK: recompute finalizado.')
}

// ------------------------ CLI helper ------------------------

const isDirectRun = (() => {
  try {
    // quando executado diretamente: `node dist/worker.js` ou `tsx src/worker.ts`
    // process.argv[1] aponta para o arquivo “main”
    const thisFile = fileURLToPath(import.meta.url);
    return process.argv[1] && (thisFile === process.argv[1]);
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  const runOnce = process.argv.includes('--once') || process.argv.includes('--run');
  const debug = process.argv.includes('--debug') || process.env.DEBUG_AGG_LOG === '1';
  recomputeAll(debug).then(() => {
    if (runOnce) process.exit(0);
  }).catch(err => {
    console.error('[aggregator] error:', err);
    process.exit(1);
  });
}