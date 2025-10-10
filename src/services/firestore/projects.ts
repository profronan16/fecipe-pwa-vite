// src/services/firestore/projects.ts
import {
  collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, where
} from 'firebase/firestore'
import { db } from '@services/firebase'

export type Project = {
  id: string
  titulo: string
  categoria: string
  turma?: string
  orientador?: string
  alunos?: string[]
  anoSemestre?: string
  /** Visibilidade: ['ALL'] para público; ou e-mails minúsculos dos avaliadores vinculados */
  assignedEvaluators?: string[]
}

/** Lista todos os projetos (admin) */
export async function listProjects(): Promise<Project[]> {
  const snap = await getDocs(collection(db, 'trabalhos'))
  return snap.docs.map((d) => {
    const data = d.data() as any
    const p: Project = {
      id: d.id,
      titulo: String(data.titulo ?? ''),
      categoria: String(data.categoria ?? ''),
      turma: data.turma ?? '',
      orientador: data.orientador ?? '',
      alunos: Array.isArray(data.alunos) ? data.alunos : [],
      anoSemestre: data.anoSemestre ?? '',
      assignedEvaluators: Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : undefined,
    }
    return p
  })
}

export async function getProject(id: string): Promise<Project | null> {
  const s = await getDoc(doc(db, 'trabalhos', id))
  if (!s.exists()) return null
  const data = s.data() as any
  const p: Project = {
    id: s.id,
    titulo: String(data.titulo ?? ''),
    categoria: String(data.categoria ?? ''),
    turma: data.turma ?? '',
    orientador: data.orientador ?? '',
    alunos: Array.isArray(data.alunos) ? data.alunos : [],
    anoSemestre: data.anoSemestre ?? '',
    assignedEvaluators: Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : undefined,
  }
  return p
}

/** Cria/atualiza um projeto (merge) */
export async function saveProject(p: Project) {
  const ref = doc(db, 'trabalhos', p.id)
 await setDoc(ref, {
  titulo: (p.titulo || '').trim(),
  categoria: (p.categoria || '').trim(),     // ← importante
  turma: (p.turma || '').trim(),
  orientador: (p.orientador || '').trim(),
  alunos: Array.isArray(p.alunos) ? p.alunos : [],
  anoSemestre: (p.anoSemestre || '').trim(),
  assignedEvaluators: normalizeAssigned(p.assignedEvaluators),
  updatedAt: new Date(),
}, { merge: true })
}

/** Patch parcial */
export async function patchProject(id: string, patch: Partial<Project>) {
  const ref = doc(db, 'trabalhos', id)
  await updateDoc(ref, {
    ...patch,
    assignedEvaluators: patch.assignedEvaluators
      ? normalizeAssigned(patch.assignedEvaluators)
      : undefined,
    updatedAt: new Date(),
  } as any)
}

export async function deleteProject(id: string) {
  await deleteDoc(doc(db, 'trabalhos', id))
}

/** Lista projetos visíveis para um avaliador (e-mail minúsculo) */
export async function listProjectsForEvaluator(emailLower: string): Promise<Project[]> {
  const col = collection(db, 'trabalhos')
  // array-contains-any aceita até 10 valores; aqui são só 2
  const q = query(col, where('assignedEvaluators', 'array-contains-any', ['ALL', emailLower]))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as any
    const p: Project = {
      id: d.id,
      titulo: String(data.titulo ?? ''),
      categoria: String(data.categoria ?? ''),
      turma: data.turma ?? '',
      orientador: data.orientador ?? '',
      alunos: Array.isArray(data.alunos) ? data.alunos : [],
      anoSemestre: data.anoSemestre ?? '',
      assignedEvaluators: Array.isArray(data.assignedEvaluators) ? data.assignedEvaluators : undefined,
    }
    return p
  })
}

/** Normaliza: se vazio → ['ALL'] (público); se tiver emails → todos minúsculos e únicos */
/** Normaliza: público -> ['ALL']; restrito -> emails minúsculos únicos */
function normalizeAssigned(input?: string[]): string[] {
  const raw = Array.isArray(input) ? input : []

  // Se vier vazio, é público
  if (raw.length === 0) return ['ALL']

  // Se vier 'ALL' (qualquer caixa), é público
  const hasAll = raw.some(s => String(s || '').trim().toUpperCase() === 'ALL')
  if (hasAll) return ['ALL']

  // Caso restrito: normaliza emails (minúsculo, únicos)
  const emails = raw
    .map(s => String(s || '').trim().toLowerCase())
    .filter(Boolean)

  // por segurança: se alguém apagou todos no formulário, volta para público
  return emails.length ? Array.from(new Set(emails)) : ['ALL']
}

