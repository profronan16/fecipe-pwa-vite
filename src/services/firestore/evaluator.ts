import {
  collection, getDocs, query, where, doc, getDoc,
  addDoc, deleteDoc, updateDoc, orderBy, setDoc
} from 'firebase/firestore'
import { db, auth } from '@services/firebase'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth'

export type EvaluatorProfile = {
  id: string          // usamos o email como id do doc
  name?: string
  email: string
  role: 'evaluator' | 'admin'
  active?: boolean
  categorias?: string[]
}
// === AVALIAÇÕES (avaliacoes) ===

export async function listMyEvaluations(evaluatorUid: string) {
  let q: any = query(collection(db, 'avaliacoes'), where('avaliadorId', '==', evaluatorUid))
  try { q = query(q, orderBy('createdAt', 'desc')) } catch {}
  const snap = await getDocs(q)
return snap.docs.map((d) => {
  const data = d.data() as any
  return {
    id: d.id,
    name: data.name || '',
    email: data.email || d.id,
    role: (data.role || 'evaluator') as 'evaluator' | 'admin',
    active: data.active !== false,
    categorias: Array.isArray(data.categorias) ? data.categorias : [],
  } as EvaluatorProfile
})}

export async function getProjectTitle(trabalhoId: string) {
  const s = await getDoc(doc(db, 'trabalhos', trabalhoId))
  return s.exists() ? (s.data() as any).titulo as string : '—'
}

// === AVALIADORES (users) ===

export async function listEvaluators() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map(d => {
    const data = d.data() as any
    return { id: d.id, name: data.name || '(sem nome)', role: data.role || 'evaluator' }
  })
}

export async function deleteEvaluator(email: string) {
  await deleteDoc(doc(db, 'users', email))
}

export async function createEvaluator(name: string, email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', cred.user.email!), { name, role: 'evaluator' })
}

export async function updateEvaluatorName(email: string, name: string) {
  await updateDoc(doc(db, 'users', email), { name })
}

export async function sendResetLink(email: string) {
  await sendPasswordResetEmail(auth, email)
}
