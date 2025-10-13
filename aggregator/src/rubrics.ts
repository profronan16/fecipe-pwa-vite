// aggregator/src/rubrics.ts

export type RubricDef = {
  id: string
  criteria: string[]
  weights: Record<string, number>
}

const NINE = ['c1','c2','c3','c4','c5','c6','c7','c8','c9']
const SIX  = ['c1','c2','c3','c4','c5','c6']

// TODO: TROCAR pelos pesos reais do edital
const W_EQ_9 = Object.fromEntries(NINE.map(k => [k, 1]))
const W_EQ_6 = Object.fromEntries(SIX.map(k => [k, 1]))

export const RUBRICS: Record<string, RubricDef> = {
  'banner-ensino':   { id: 'banner-ensino',   criteria: NINE, weights: { ...W_EQ_9 } },
  'banner-pesquisa': { id: 'banner-pesquisa', criteria: NINE, weights: { ...W_EQ_9 } },
  'banner-extensao': { id: 'banner-extensao', criteria: NINE, weights: { ...W_EQ_9 } },
  'comoral':         { id: 'comoral',         criteria: NINE, weights: { ...W_EQ_9 } },
  'iftech':          { id: 'iftech',          criteria: SIX,  weights: { ...W_EQ_6 } },
  'feira':           { id: 'feira',           criteria: SIX,  weights: { ...W_EQ_6 } }
}

const norm = (s?: string) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function rubricIdForProject(
  categoria?: string,
  subcategoria?: string
): string {
  const c = norm(categoria)
  const s = norm(subcategoria)
  if (c.includes('iftech')) return 'iftech'
  if (c.includes('feira'))  return 'feira'
  if (c.includes('comunicacao')) return 'comoral'
  if (c.includes('banner')) {
    if (s.includes('ensino')) return 'banner-ensino'
    if (s.includes('extens')) return 'banner-extensao'
    return 'banner-pesquisa'
  }
  return 'comoral'
}
