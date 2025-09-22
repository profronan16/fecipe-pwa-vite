// Centralize rubric weights here
export type ScoreItem = { key:string; label:string; weight:number }
export const DEFAULT_RUBRIC: ScoreItem[] = [
  { key:'criterio1', label:'Relevância', weight:2 },
  { key:'criterio2', label:'Metodologia', weight:3 },
  { key:'criterio3', label:'Originalidade', weight:2 },
  { key:'criterio4', label:'Apresentação', weight:3 },
]
export function computeScore(values: Record<string, number>){
  let total = 0, max = 0
  for(const it of DEFAULT_RUBRIC){
    total += (values[it.key] || 0) * it.weight
    max += 10 * it.weight
  }
  return { total, max }
}
