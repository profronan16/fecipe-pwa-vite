// src/services/firestore/aggregates.ts
import { db } from '@services/firebase'
import {
  doc, getDoc, collection, query, where, getDocs, DocumentData,
} from 'firebase/firestore'

export type WorkAggregate = {
  workId: string
  nf?: number
  nci?: Record<string, number>
  meanByCriterion?: Record<string, number>
  rubricId?: string
}

export async function getWorkAggregate(workId: string): Promise<WorkAggregate | null> {
  const ref = doc(db, 'workAggregates', workId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const d = snap.data() as DocumentData
  return {
    workId: snap.id,
    nf: typeof d.nf === 'number' ? d.nf : undefined,
    nci: d.nci || undefined,
    meanByCriterion: d.meanByCriterion || undefined,
    rubricId: d.rubricId || undefined,
  }
}

/**
 * Retorna o top 3 de avaliadores de um trabalho, com soma simples das notas
 * (total = somatório de scores do documento de avaliação).
 * Se quiser outro critério de "top", ajuste aqui.
 */
export async function getTopEvaluatorsForWork(workId: string, limit = 3): Promise<Array<{
  uid: string
  total: number
}>> {
  const q = query(collection(db, 'avaliacoes'), where('trabalhoId', '==', workId))
  const snap = await getDocs(q)

  const arr: Array<{ uid: string; total: number }> = []
  for (const d of snap.docs) {
    const data = d.data() as any
    const uid = String(data.avaliadorId || '')
    const scores: Record<string, unknown> = data.scores ?? data.notas ?? {}
    let total = 0
    for (const v of Object.values(scores)) {
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
      if (Number.isFinite(n)) total += n
    }
    if (uid) arr.push({ uid, total })
  }
  arr.sort((a, b) => b.total - a.total)
  return arr.slice(0, limit)
}

/** Resolve nomes dos usuários a partir dos UIDs. */
export async function getUserNames(uids: string[]): Promise<Record<string, string>> {
  if (!uids.length) return {}
  // Se sua coleção for 'users' com docId === uid:
  const map: Record<string, string> = {}
  // Otimização simples: buscar 1 a 1 (pode trocar por 'in' quando fizer índices por lotes de 10)
  await Promise.all(uids.map(async (uid) => {
    const ref = doc(db, 'users', uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const d = snap.data() as any
      map[uid] = d.displayName || d.name || d.nome || d.email || uid
    } else {
      map[uid] = uid
    }
  }))
  return map
}
