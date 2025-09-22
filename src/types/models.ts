export type UserRole = "admin" | "evaluator";
export type Project = {
  id?: string;
  titulo: string;
  categoria?: string;
  banca?: string;
  autores?: string[];
  assignedEvaluators?: string[]; // uids dos avaliadores atribuídos
  status?: "pendente" | "em_andamento" | "concluido";
  createdAt?: any; // Timestamp (Firestore)
  updatedAt?: any; // Timestamp (Firestore)
};
export type Evaluation = {
  id?: string;
  projectId: string;
  evaluatorId: string;
  categoria?: string;
  notas: Record<string, number>; // ex.: { criterio1: 8, criterio2: 9, ... }
  comments?: string;
  finalScore?: number;
  createdAt?: any;
  updatedAt?: any;
};
