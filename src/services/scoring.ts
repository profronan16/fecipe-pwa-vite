// src/services/scoring.ts
/**
 * Utilitários para cálculo de NCi e NF no cliente, e leitura de agregados.
 * - rubricStats/{rubricId}/criteria/{cId} → { mean, std }
 * - workAggregates/{workId} → { meanByCriterion (NaCi), nci, nf }
 */

import { db } from '@services/firebase'
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'
import { getRubricDef } from '@shared/rubrics'

export type CriterionStats = {
  mean?: number // MCi
  std?: number  // σCi
}

/**
 * Carrega stats (MCi, σCi) por critério de uma rúbrica.
 */
export async function loadRubricStats(rubricId: string): Promise<Record<string, CriterionStats>> {
  const out: Record<string, CriterionStats> = {}
  const col = collection(db, 'rubricStats', rubricId, 'criteria')
  const snap = await getDocs(col)
  snap.docs.forEach(d => {
    const data = d.data() as any
    out[d.id] = { mean: data.mean ?? 0, std: data.std ?? 0 }
  })
  return out
}

/**
 * Lê agregados de um trabalho (NaCi, nci, nf) se materializados.
 */
export async function loadWorkAggregates(workId: string): Promise<{
  meanByCriterion?: Record<string, number> // NaCi
  nci?: Record<string, number>
  nf?: number
} | null> {
  const ref = doc(db, 'workAggregates', workId)
  const snap = await getDoc(ref)
  return snap.exists() ? (snap.data() as any) : null
}

/**
 * Calcula NCi e NF no cliente (sem materialização), dado:
 * - rubricId para pegar pesos/critérios;
 * - NaCi (média dos avaliadores por critério do trabalho);
 * - stats (MCi e σCi) carregados de rubricStats.
 *
 * A fórmula: NCi = ((NaCi − MCi) / σCi) + z, com z = 2.5; se σCi=0 => NCi=z.
 * NF = Σ (NCi × pCi)
 */
export function computeNFOnClient(
  rubricId: string,
  Na: Record<string, number> | undefined,
  stats: Record<string, CriterionStats>
): { nci: Record<string, number>, nf: number } {
  const { criteria, weights } = getRubricDef(rubricId)
  const z = 2.5
  const nci: Record<string, number> = {}
  let nf = 0

  for (const cId of criteria) {
    const NaCi = Na?.[cId]
    if (typeof NaCi !== 'number') continue
    const MCi = stats[cId]?.mean ?? 0
    const sigma = stats[cId]?.std ?? 0
    const NCi = sigma > 0 ? ((NaCi - MCi) / sigma) + z : z
    nci[cId] = NCi
    const w = weights[cId] ?? 1
    nf += NCi * w
  }
  return { nci, nf }
}

/**
 * Conveniência: tenta usar `workAggregates` (se existir),
 * senão computa no cliente com base em `rubricStats`.
 */
export async function getNFForWork(
  workId: string,
  rubricId: string
): Promise<{ nci: Record<string, number>, nf: number, source: 'materialized' | 'computed' }> {
  const agg = await loadWorkAggregates(workId)
  if (agg?.nf != null && agg?.nci) {
    return { nci: agg.nci, nf: agg.nf, source: 'materialized' }
  }
  const stats = await loadRubricStats(rubricId)
  const { nci, nf } = computeNFOnClient(rubricId, agg?.meanByCriterion, stats)
  return { nci, nf, source: 'computed' }
}
