// src/services/firestore/aggregates.ts
import { db } from '@services/firebase'
import {
  doc, getDoc, collection, query, where, getDocs, limit as qLimit, DocumentData,
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
 * Soma simples dos critérios no doc de avaliação (scores/notas).
 */
function sumScores(scores: Record<string, unknown> | undefined): number {
  if (!scores) return 0
  let total = 0
  for (const v of Object.values(scores)) {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
    if (Number.isFinite(n)) total += n
  }
  return total
}

/**
 * Top N avaliadores (por soma de notas no trabalho).
 */
export async function getTopEvaluatorsForWork(workId: string, topN = 3): Promise<Array<{ uid: string; total: number }>> {
  const q = query(collection(db, 'avaliacoes'), where('trabalhoId', '==', workId))
  const snap = await getDocs(q)

  const arr: Array<{ uid: string; total: number }> = []
  for (const d of snap.docs) {
    const data = d.data() as any
    const uid = String(data.avaliadorId || '')
    if (!uid) continue
    const total = sumScores((data.scores ?? data.notas) as Record<string, unknown>)
    arr.push({ uid, total })
  }
  arr.sort((a, b) => b.total - a.total)
  return arr.slice(0, topN)
}

/**
 * Resolve nome do usuário para um único UID:
 * - tenta users/{uid}
 * - senão, busca users where uid == uid (doc com ID = e-mail, p.ex.)
 */
async function resolveUserName(uid: string): Promise<string> {
  // 1) doc(users/{uid})
  const byId = await getDoc(doc(db, 'users', uid))
  if (byId.exists()) {
    const d = byId.data() as any
    return d.displayName || d.name || d.nome || d.email || uid
  }

  // 2) query(users, where('uid','==', uid))
  const qUid = query(collection(db, 'users'), where('uid', '==', uid), qLimit(1))
  const snapUid = await getDocs(qUid)
  if (!snapUid.empty) {
    const d = snapUid.docs[0].data() as any
    return d.displayName || d.name || d.nome || d.email || uid
  }

  // 3) fallback
  return uid
}

/**
 * Resolve nomes para um array de UIDs. Faz busca individual resiliente
 * (evita limite do "in" e suporta docId != uid).
 */
export async function getUserNames(uids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  // elimina duplicados
  const unique = Array.from(new Set(uids.filter(Boolean)))
  await Promise.all(
    unique.map(async (u) => {
      out[u] = await resolveUserName(u)
    })
  )
  return out
}
