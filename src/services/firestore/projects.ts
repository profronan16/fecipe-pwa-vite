import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  FirestoreDataConverter,
  DocumentData,
} from "firebase/firestore";
import { db } from "@services/firebase";
import type { Project } from "@models/models";

// 🔧 Coleção configurável: deixe "projects" (PWA) ou troque para "trabalhos" (seu RN).
// Se preferir, defina VITE_FS_PROJECTS_COLLECTION no .env.local
const COLLECTION =
  (import.meta.env.VITE_FS_PROJECTS_COLLECTION as string) || "projects";

// ---------- Converter tipado (Project) ----------
const projectConverter: FirestoreDataConverter<Project> = {
  toFirestore(p: Project): DocumentData {
    const { id, ...rest } = p;
    // adicione updatedAt em writes parciais
    return {
      ...rest,
      updatedAt: serverTimestamp(),
    };
  },
  fromFirestore(snapshot, options): Project {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      titulo: data.titulo,
      categoria: data.categoria,
      banca: data.banca,
      autores: data.autores,
      assignedEvaluators: data.assignedEvaluators,
      status: data.status,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  },
};

// Coleção tipada com converter
const projectsCol = collection(db, COLLECTION).withConverter(projectConverter);

// ---------- CRUD / Consultas ----------

// Lista projetos por categoria (ou todos)
export async function listProjectsByCategory(
  category?: string
): Promise<Project[]> {
  const q = category
    ? query(projectsCol, where("categoria", "==", category), orderBy("titulo"))
    : query(projectsCol, orderBy("titulo"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// Lista projetos atribuídos a um avaliador (filtrando opcionalmente por categoria)
export async function listAssignedWorks(
  evaluatorUid: string,
  category?: string
): Promise<Project[]> {
  let q: any = query(
    projectsCol,
    where("assignedEvaluators", "array-contains", evaluatorUid)
  );
  if (category) {
    q = query(
      projectsCol,
      where("assignedEvaluators", "array-contains", evaluatorUid),
      where("categoria", "==", category)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

// Busca único projeto por id
export async function getProject(id: string): Promise<Project | null> {
  const ref = doc(db, COLLECTION, id).withConverter(projectConverter);
  const s = await getDoc(ref);
  return s.exists() ? s.data()! : null;
}

// Cria um projeto
export async function addProject(
  data: Omit<Project, "id" | "createdAt" | "updatedAt">
) {
  return addDoc(projectsCol, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// Atualiza parcialmente um projeto
export async function updateProject(id: string, data: Partial<Project>) {
  // updateDoc não usa converter, então mandamos objeto “puro”
  const ref = doc(db, COLLECTION, id);
  return updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  } as any);
}

// (Opcional) Lista por banca
export async function listProjectsByBanca(banca: string): Promise<Project[]> {
  const q = query(projectsCol, where("banca", "==", banca), orderBy("titulo"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
