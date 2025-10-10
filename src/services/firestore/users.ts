// src/services/firestore/users.ts
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@services/firebase'

export type UserRecord = {
  id: string            // usamos o e-mail minúsculo como ID do doc
  name?: string
  email: string
  role: 'admin' | 'evaluator'
  active?: boolean
  categorias?: string[]
}

/** Lista todos os usuários com papel evaluator/admin */
export async function listUsers(): Promise<UserRecord[]> {
  const q = query(collection(db, 'users'), where('role', 'in', ['evaluator', 'admin']))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as any
    const u: UserRecord = {
      id: d.id,
      name: data.name || '',
      email: data.email || d.id,
      role: (data.role || 'evaluator') as 'admin' | 'evaluator',
      active: data.active !== false,
      categorias: Array.isArray(data.categorias) ? data.categorias : [],
    }
    return u
  })
}

/** Obtém um usuário pelo e-mail (minúsculo) */
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const key = (email || '').toLowerCase()
  const s = await getDoc(doc(db, 'users', key))
  if (!s.exists()) return null
  const data = s.data() as any
  const u: UserRecord = {
    id: s.id,
    name: data.name || '',
    email: data.email || s.id,
    role: (data.role || 'evaluator') as 'admin' | 'evaluator',
    active: data.active !== false,
    categorias: Array.isArray(data.categorias) ? data.categorias : [],
  }
  return u
}

/** Cria/atualiza (merge) um usuário */
export async function upsertUser(u: UserRecord) {
  const key = (u.email || u.id).toLowerCase()
  await setDoc(
    doc(db, 'users', key),
    {
      name: u.name || '',
      email: key,
      role: u.role,
      active: u.active !== false,
      categorias: Array.isArray(u.categorias) ? u.categorias : [],
      updatedAt: new Date(),
    },
    { merge: true }
  )
}

/** Patch parcial (ex.: alterar role/active) */
export async function patchUser(email: string, patch: Partial<UserRecord>) {
  const key = (email || '').toLowerCase()
  await updateDoc(doc(db, 'users', key), {
    ...patch,
    updatedAt: new Date(),
  } as any)
}
