import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "@services/firebase";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

type Evaluation = {
  id: string
  trabalhoId: string
  evaluatorEmail?: string
  avaliadorId?: string
  notas: Record<string, number>
  createdAt?: any
  updatedAt?: any
}

// === AVALIAÇÕES (avaliacoes) ===

// Lista avaliações do avaliador logado, ordenadas por data (se existir)
export async function listMyEvaluations(evaluatorUid: string) {
  let q: any = query(
    collection(db, "avaliacoes"),
    where("avaliadorId", "==", evaluatorUid)
  );
  try {
    q = query(q, orderBy("createdAt", "desc"));
  } catch {
    /* ok se não existir */
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any
    return {
      id: d.id,
      trabalhoId: String(data.trabalhoId ?? ''),
      evaluatorEmail: data.evaluatorEmail,
      avaliadorId: data.avaliadorId,
      notas: (data.notas ?? {}) as Record<string, number>,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as Evaluation
  })
}

// Traz título do projeto a partir de trabalhos/{id}
export async function getProjectTitle(trabalhoId: string) {
  const s = await getDoc(doc(db, "trabalhos", trabalhoId));
  return s.exists() ? ((s.data() as any).titulo as string) : "—";
}

// === AVALIADORES (users) ===

export async function listEvaluators() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      name: data.name || "(sem nome)",
      role: data.role || "evaluator",
    };
  });
}

export async function deleteEvaluator(email: string) {
  await deleteDoc(doc(db, "users", email));
}

export async function createEvaluator(
  name: string,
  email: string,
  password: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateDocOrSet(doc(db, "users", cred.user.email!), {
    name,
    role: "evaluator",
  });
}

export async function updateEvaluatorName(email: string, name: string) {
  await updateDocOrSet(doc(db, "users", email), { name });
}

async function updateDocOrSet(ref: any, data: any) {
  try {
    await updateDoc(ref, data);
  } catch {
    const { setDoc } = await import("firebase/firestore");
    await setDoc(ref, data);
  }
}

export async function sendResetLink(email: string) {
  await sendPasswordResetEmail(auth, email);
}
