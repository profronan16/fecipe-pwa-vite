// aggregator/src/rubrics.ts
// -----------------------------------------------------------------------------
// Resolução de rúbrica (grupo estatístico), critérios e pesos.
// Mantém a fórmula existente; só garante o agrupamento correto por categoria.
// -----------------------------------------------------------------------------

export type RubricId =
  | 'iftech'
  | 'feira'
  | 'comoral'
  | 'banner-ensino'
  | 'banner-extensao'
  | 'banner-pesquisa'

export type CriterionId = 'C1'|'C2'|'C3'|'C4'|'C5'|'C6'|'C7'|'C8'|'C9'

/** Quantos critérios cada rúbrica possui */
export function criteriaFor(rubric: RubricId): CriterionId[] {
  if (rubric === 'iftech' || rubric === 'feira') return ['C1','C2','C3','C4','C5','C6']
  return ['C1','C2','C3','C4','C5','C6','C7','C8','C9']
}

/** Pesos por rúbrica (tabelas que você forneceu) */
export function weightsFor(rubric: RubricId): Record<CriterionId, number> {
  if (rubric === 'iftech' || rubric === 'feira') {
    // 6 critérios — Anexos V e VI
    return { C1: 0.75, C2: 1, C3: 0.5, C4: 1, C5: 0.75, C6: 1, C7: 0, C8: 0, C9: 0 }
  }
  // 9 critérios — Anexos I a IV
  return { C1: 0.9, C2: 0.8, C3: 0.7, C4: 0.6, C5: 0.6, C6: 0.4, C7: 0.4, C8: 0.3, C9: 0.3 }
}

/** Normalização básica de strings (sem acentos / caixa baixa) */
function norm(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Resolve a rúbrica (id) do projeto:
 * - IFTECH → "iftech" (6)
 * - Feira de Ciências → "feira" (6)
 * - Comunicação Oral → "comoral" (9)
 * - Banner → separa por subcategoria (9): ensino / extensao / pesquisa
 */
export function resolveRubricId(project: {
  categoria?: string | null
  subcategoria?: string | null
}): RubricId {
  const cat = norm(project.categoria)
  const sub = norm(project.subcategoria)

  if (cat === 'iftech') return 'iftech'
  if (cat === 'feira de ciencias' || cat === 'feira de ciencias' || cat === 'feira de ciências') return 'feira'
  if (cat === 'comunicacao oral' || cat === 'comunicacao  oral' || cat === 'comunicação oral') return 'comoral'

  if (cat === 'banner') {
    if (sub.startsWith('ensino')) return 'banner-ensino'
    if (sub.startsWith('extensao') || sub.startsWith('extensão')) return 'banner-extensao'
    // qualquer coisa que remeta a pesquisa/inovação
    return 'banner-pesquisa'
  }

  // fallback seguro (9 critérios) — evita quebrar caso venha um rótulo diferente
  return 'comoral'
}

/** Título amigável para logs/relatórios */
export function rubricTitle(r: RubricId): string {
  switch (r) {
    case 'iftech': return 'IFTECH (6 critérios)'
    case 'feira': return 'Feira de Ciências (6 critérios)'
    case 'comoral': return 'Comunicação Oral (9 critérios)'
    case 'banner-ensino': return 'Banner — Ensino (9 critérios)'
    case 'banner-extensao': return 'Banner — Extensão (9 critérios)'
    case 'banner-pesquisa': return 'Banner — Pesquisa/Inovação (9 critérios)'
  }
}
