// src/services/admin/maintenance.ts
import {
  collection, getDocs, writeBatch, doc, query, limit as qlimit, DocumentData,
} from 'firebase/firestore'
import { db } from '@services/firebase'

/** Apaga documentos de uma coleção em lotes (até 500 por commit).
 * Retorna o número de documentos apagados. */
export async function batchDeleteCollection(
  collectionPath: string,
  batchSize = 300
): Promise<number> {
  let totalDeleted = 0
  while (true) {
    const snap = await getDocs(query(collection(db, collectionPath), qlimit(batchSize)))
    if (snap.empty) break
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(doc(db, collectionPath, d.id)))
    await batch.commit()
    totalDeleted += snap.size
    if (snap.size < batchSize) break
  }
  return totalDeleted
}

/** Remove todos os usuários, exceto o admin informado (por e-mail, case-insensitive). */
export async function keepOnlyAdminUser(keepAdminEmail: string): Promise<{ kept: number; deleted: number }> {
  const emailNorm = (keepAdminEmail || '').trim().toLowerCase()
  const usersSnap = await getDocs(collection(db, 'usuarios'))

  const toDelete = usersSnap.docs.filter((d) => {
    const data = d.data() as any
    const e = String(data.email || '').toLowerCase()
    // mantém apenas o admin com e-mail igual ao informado
    return e !== emailNorm
  })

  // Se nenhum usuário bate com o admin informado, mantemos 0 e apagamos todos
  const batchSize = 300
  let deleted = 0
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const slice = toDelete.slice(i, i + batchSize)
    const batch = writeBatch(db)
    slice.forEach((d) => batch.delete(doc(db, 'usuarios', d.id)))
    await batch.commit()
    deleted += slice.length
  }

  const kept = usersSnap.size - deleted
  return { kept, deleted }
}

/** Limpa base: apaga trabalhos, avaliacoes, e todos os usuarios exceto o admin. */
export async function wipeDatabaseKeepAdmin(keepAdminEmail: string) {
  // 1) Apagar trabalhos e avaliações
  const deletedTrabalhos = await batchDeleteCollection('trabalhos')
  const deletedAvaliacoes = await batchDeleteCollection('avaliacoes')

  // 2) Manter somente admin em usuarios
  const usersRes = await keepOnlyAdminUser(keepAdminEmail)

  return {
    trabalhosApagados: deletedTrabalhos,
    avaliacoesApagadas: deletedAvaliacoes,
    usuariosMantidos: usersRes.kept,
    usuariosApagados: usersRes.deleted,
  }
}

/** Schema novo dos projetos — apenas os campos atuais. */
const PROJECT_FIELDS_NEW = [
  'id',
  'titulo',
  'categoria',
  'subcategoria',
  'tipo',
  'area',
  'apresentador',
  'autores',
  'assignedEvaluators',
  'updatedAt',
] as const

type NewProjectShape = {
  id: string
  titulo: string
  categoria?: string
  subcategoria?: string
  tipo?: string
  area?: string
  apresentador?: string
  autores?: string[]
  assignedEvaluators?: string[]
  updatedAt?: any
}

/** Migra cada documento da coleção `trabalhos` para conter SOMENTE os campos do schema novo. */
export async function migrateProjectsToNewSchema(): Promise<{ migrated: number }> {
  const snap = await getDocs(collection(db, 'trabalhos'))
  if (snap.empty) return { migrated: 0 }

  // processa em lotes (até 500 por batch)
  const batchSize = 300
  let migrated = 0
  let buffer: DocumentData[] = []

  for (const d of snap.docs) {
    const data = d.data() as any
    const cleanDoc: NewProjectShape = {
      id: d.id,
      titulo: String(data.titulo || ''),
      categoria: data.categoria || '',
      subcategoria: data.subcategoria || '',
      tipo: data.tipo || '',
      area: data.area || '',
      apresentador: data.apresentador || '',
      autores: Array.isArray(data.autores) ? data.autores : [],
      assignedEvaluators: Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : ['ALL'],
      updatedAt: data.updatedAt || null,
    }
    buffer.push({ id: d.id, data: cleanDoc } as any)

    if (buffer.length >= batchSize) {
      const batch = writeBatch(db)
      buffer.forEach((b: any) => {
        batch.set(doc(db, 'trabalhos', b.id), b.data, { merge: false }) // merge:false remove campos antigos
      })
      await batch.commit()
      migrated += buffer.length
      buffer = []
    }
  }

  if (buffer.length) {
    const batch = writeBatch(db)
    buffer.forEach((b: any) => {
      batch.set(doc(db, 'trabalhos', b.id), b.data, { merge: false })
    })
    await batch.commit()
    migrated += buffer.length
  }

  return { migrated }
}
