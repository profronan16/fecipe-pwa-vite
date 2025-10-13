// src/shared/rubrics.ts
/**
 * Definições de rúbrica (quais critérios c1..ck e pesos pCi cada categoria usa)
 * e helpers para derivar rubricId a partir do projeto.
 *
 * IMPORTANTE: Ajuste os PESOS conforme o edital. Coloquei exemplos/igualitários
 * para não travar a build. Depois só trocar os valores aqui.
 */

export type RubricDef = {
  id: string
  criteria: string[]              // ex.: ['c1','c2',...,'c9']
  weights: Record<string, number> // ex.: { c1: 0.18, c2: 0.16, ... }
}

// ---- Exemplos de pesos (ajuste pelos pesos do edital) ----
const NINE = ['c1','c2','c3','c4','c5','c6','c7','c8','c9']
const SIX  = ['c1','c2','c3','c4','c5','c6']

const W_EQ_9 = Object.fromEntries(NINE.map(k => [k, 1]))   // substitua pelos pesos reais (pCi)
const W_EQ_6 = Object.fromEntries(SIX.map(k  => [k, 1]))   // substitua pelos pesos reais (pCi)

// Se você já tiver os pesos reais, ajuste abaixo.
// Ex.: Banner-Ensino: { c1: 0.18, c2: 0.16, c3: 0.14, c4: 0.12, c5: 0.12, c6: 0.08, c7: 0.08, c8: 0.06, c9: 0.06 }
export const RUBRICS: Record<string, RubricDef> = {
  'banner-ensino':   { id: 'banner-ensino',   criteria: NINE, weights: { ...W_EQ_9 } },
  'banner-pesquisa': { id: 'banner-pesquisa', criteria: NINE, weights: { ...W_EQ_9 } },
  'banner-extensao': { id: 'banner-extensao', criteria: NINE, weights: { ...W_EQ_9 } },
  'comoral':         { id: 'comoral',         criteria: NINE, weights: { ...W_EQ_9 } },
  'iftech':          { id: 'iftech',          criteria: SIX,  weights: { ...W_EQ_6 } },
  'feira':           { id: 'feira',           criteria: SIX,  weights: { ...W_EQ_6 } },
}

/**
 * Normaliza string para comparação leve.
 */
const norm = (s?: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/**
 * Retorna o rubricId para um projeto, com base em categoria/subcategoria/tipo.
 * OBS: se "Comunicação Oral" tem os MESMOS critérios/pesos para Médio/Superior/Pós/Servidor,
 * mantemos um rubricId único ("comoral"). Se você precisa separar por nível, crie
 * ids como "comoral-medio", etc. e reflita isso em RUBRICS.
 */
export function rubricIdForProject(
  categoria?: string,
  subcategoria?: string,
  tipo?: string
): string {
  const c = norm(categoria)
  const s = norm(subcategoria)

  if (c.includes('iftech')) return 'iftech'
  if (c.includes('feira'))  return 'feira'
  if (c.includes('comunicacao')) return 'comoral'

  if (c.includes('banner')) {
    if (s.includes('ensino'))   return 'banner-ensino'
    if (s.includes('extens'))   return 'banner-extensao'
    // default pesquisa/inovação
    return 'banner-pesquisa'
  }

  // fallback seguro (comunicação oral)
  return 'comoral'
}

/**
 * Obtém definição da rúbrica; retorna 'comoral' como fallback.
 */
export function getRubricDef(rubricId?: string): RubricDef {
  if (rubricId && RUBRICS[rubricId]) return RUBRICS[rubricId]
  return RUBRICS['comoral']
}
