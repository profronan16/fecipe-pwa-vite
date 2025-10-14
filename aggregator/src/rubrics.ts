// aggregator/src/rubrics.ts
// Define as rúbricas (critérios e pesos) por categoria/subcategoria/tipo
// Edital:
// - Ensino, Pesquisa/Inovação, Extensão, Comunicação Oral e Banner => 9 critérios
//   Pesos: [0.9, 0.8, 0.7, 0.6, 0.6, 0.4, 0.4, 0.3, 0.3]
// - IFTECH e Feira de Ciências => 6 critérios
//   Pesos: [0.75, 1, 0.5, 1, 0.75, 1]

export type CriterionId = string

export type Rubric = {
  id: string
  label: string
  criteria: CriterionId[]                 // ordem dos critérios
  weights: Record<CriterionId, number>    // pesos por critério
  z: number                               // constante de escala (2.5)
}

// ---------- Helpers ----------
function normalize(str?: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .trim()
}

// ---------- RÚBRICAS ----------

// 6 critérios (IFTECH / Feira)
const SIX_CRITERIA: CriterionId[] = ['C1','C2','C3','C4','C5','C6']
const SIX_WEIGHTS: Record<CriterionId, number> = {
  C1: 0.75, C2: 1, C3: 0.5, C4: 1, C5: 0.75, C6: 1,
}

// 9 critérios (Ensino / Pesquisa / Extensão / Com. Oral / Banner)
const NINE_CRITERIA: CriterionId[] = ['C1','C2','C3','C4','C5','C6','C7','C8','C9']
const NINE_WEIGHTS: Record<CriterionId, number> = {
  C1: 0.9, C2: 0.8, C3: 0.7, C4: 0.6, C5: 0.6, C6: 0.4, C7: 0.4, C8: 0.3, C9: 0.3,
}

export const RUBRICS: Rubric[] = [
  {
    id: 'IFTECH',
    label: 'IFTECH (6 critérios)',
    criteria: SIX_CRITERIA,
    weights: SIX_WEIGHTS,
    z: 2.5,
  },
  {
    id: 'FEIRA',
    label: 'Feira de Ciências (6 critérios)',
    criteria: SIX_CRITERIA,
    weights: SIX_WEIGHTS,
    z: 2.5,
  },
  {
    id: 'ANEXO_I_IV',
    label: 'Ensino / Pesquisa / Extensão / Comunicação Oral / Banner (9 critérios)',
    criteria: NINE_CRITERIA,
    weights: NINE_WEIGHTS,
    z: 2.5,
  },
]

// ---------- Resolver da rúbrica a partir do doc do trabalho ----------

/**
 * Retorna a rúbrica adequada para um trabalho, com base principalmente em `categoria`.
 * - IFTECH -> 'IFTECH'
 * - FEIRA DE CIENCIAS -> 'FEIRA'
 * - COMUNICACAO ORAL, BANNER, ENSINO, PESQUISA, EXTENSAO -> 'ANEXO_I_IV' (9 critérios)
 * Fallback: 'ANEXO_I_IV'
 */
export function resolveRubricIdFromWork(work: any): Rubric {
  const catN = normalize(work?.categoria)
  const subcatN = normalize(work?.subcategoria)
  const tipoN = normalize(work?.tipo)

  // IFTECH (6)
  if (catN.includes('IFTECH')) {
    return RUBRICS.find(r => r.id === 'IFTECH')!
  }

  // FEIRA DE CIÊNCIAS (6)
  if (catN.includes('FEIRA')) {
    return RUBRICS.find(r => r.id === 'FEIRA')!
  }

  // Comunicação Oral / Banner / Ensino / Pesquisa / Extensão (9)
  if (
    catN.includes('COMUNICACAO') ||
    catN.includes('BANNER') ||
    catN.includes('ENSINO') ||
    catN.includes('PESQUISA') ||
    catN.includes('INOVACAO') ||
    catN.includes('EXTENSAO') ||
    subcatN.includes('ENSINO') ||
    subcatN.includes('PESQUISA') ||
    subcatN.includes('INOVACAO') ||
    subcatN.includes('EXTENSAO') ||
    tipoN.includes('FUNDAMENTAL') ||
    tipoN.includes('MEDIO') ||
    tipoN.includes('SUPERIOR') ||
    tipoN.includes('POS')
  ) {
    return RUBRICS.find(r => r.id === 'ANEXO_I_IV')!
  }

  // Fallback seguro: usar 9 critérios (mais comum para CO/Banner/Ensino/Pesquisa/Extensão)
  return RUBRICS.find(r => r.id === 'ANEXO_I_IV')!
}

// Exporte também as constantes caso queira usar em testes
export const RUBRIC_IDS = {
  IFTECH: 'IFTECH',
  FEIRA: 'FEIRA',
  ANEXO_I_IV: 'ANEXO_I_IV',
} as const
