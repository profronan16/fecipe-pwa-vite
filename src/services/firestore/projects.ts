// src/services/firestore/projects.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@services/firebase";

export interface Project {
  id: string;
  titulo: string;
  categoria?: string;
  subcategoria?: string;
  tipo?: string;
  area?: string;
  apresentador?: string;
  autores?: string[];
  assignedEvaluators?: string[]; // ["ALL"] ou lista de e-mails
  updatedAt?: any;
}

/** Normaliza lista de avaliadores (garante ["ALL"] se vazio) */
function normalizeAssigned(arr?: string[]): string[] {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return ["ALL"];
  const clean = arr.map((s) => String(s || "").trim().toLowerCase());
  if (clean.includes("all")) return ["ALL"];
  return Array.from(new Set(clean.filter(Boolean)));
}

/** Constrói objeto Project a partir de um doc do Firestore */
function mapProjectDoc(d: QueryDocumentSnapshot<DocumentData>): Project {
  const data = d.data() as any;
  return {
    id: d.id,
    titulo: data.titulo || "",
    categoria: data.categoria || "",
    subcategoria: data.subcategoria || "",
    tipo: data.tipo || "",
    area: data.area || "",
    apresentador: data.apresentador || "",
    autores: Array.isArray(data.autores) ? data.autores : [],
    assignedEvaluators: Array.isArray(data.assignedEvaluators)
      ? data.assignedEvaluators
      : ["ALL"],
    updatedAt: data.updatedAt || null,
  };
}

/** Cria/atualiza um projeto */
export async function saveProject(project: Project): Promise<void> {
  if (!project.titulo) throw new Error("Título é obrigatório");

  const ref = project.id
    ? doc(db, "trabalhos", project.id)
    : doc(collection(db, "trabalhos"));

  const payload: Project = {
    id: project.id || ref.id,
    titulo: project.titulo.trim(),
    categoria: project.categoria?.trim() || "",
    subcategoria: project.subcategoria?.trim() || "",
    tipo: project.tipo?.trim() || "",
    area: project.area?.trim() || "",
    apresentador: project.apresentador?.trim() || "",
    autores: project.autores || [],
    assignedEvaluators: normalizeAssigned(project.assignedEvaluators),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });
}

/** Retorna um projeto por ID */
export async function getProject(id: string): Promise<Project | null> {
  const ref = doc(db, "trabalhos", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as any;

  return {
    id: snap.id,
    titulo: data.titulo || "",
    categoria: data.categoria || "",
    subcategoria: data.subcategoria || "",
    tipo: data.tipo || "",
    area: data.area || "",
    apresentador: data.apresentador || "",
    autores: Array.isArray(data.autores) ? data.autores : [],
    assignedEvaluators: Array.isArray(data.assignedEvaluators)
      ? data.assignedEvaluators
      : ["ALL"],
    updatedAt: data.updatedAt || null,
  };
}

/** Lista todos os projetos (admin) */
export async function listProjects(): Promise<Project[]> {
  const ref = collection(db, "trabalhos");
  const snap = await getDocs(ref);
  return snap.docs.map(mapProjectDoc);
}

/** Remove um projeto */
export async function deleteProject(id: string): Promise<void> {
  const ref = doc(db, "trabalhos", id);
  await deleteDoc(ref);
}

/** Atualiza campos específicos de um projeto */
export async function updateProject(
  id: string,
  data: Partial<Project>
): Promise<void> {
  const ref = doc(db, "trabalhos", id);
  const cleanData = { ...data, updatedAt: serverTimestamp() };
  await updateDoc(ref, cleanData as any);
}

/**
 * Lista projetos visíveis para um avaliador (ou admin).
 * - admin -> retorna todos os projetos
 * - não-admin -> une:
 *   * assignedEvaluators array-contains "ALL"
 *   * assignedEvaluators array-contains <email>
 */
export async function listProjectsForEvaluator(
  email: string,
  role?: string
): Promise<Project[]> {
  const normEmail = String(email || "").trim().toLowerCase();

  if (role === "admin") {
    return listProjects();
  }

  const col = collection(db, "trabalhos");

  // Projetos disponíveis para todos
  const qAll = query(col, where("assignedEvaluators", "array-contains", "ALL"));
  const snapAll = await getDocs(qAll);

  // Projetos atribuídos explicitamente ao avaliador
  const qMine = query(col, where("assignedEvaluators", "array-contains", normEmail));
  const snapMine = await getDocs(qMine);

  // Mescla, removendo duplicados
  const map = new Map<string, Project>();
  snapAll.docs.forEach((d) => map.set(d.id, mapProjectDoc(d)));
  snapMine.docs.forEach((d) => map.set(d.id, mapProjectDoc(d)));

  // Converte para array e ordena por updatedAt desc (fallback título)
  const list = Array.from(map.values());
  list.sort((a, b) => {
    const A =
      (a.updatedAt?.toMillis?.() ??
        (a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0)) || 0;
    const B =
      (b.updatedAt?.toMillis?.() ??
        (b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0)) || 0;
    if (B !== A) return B - A;
    return (a.titulo || "").localeCompare(b.titulo || "");
  });

  return list;
}
