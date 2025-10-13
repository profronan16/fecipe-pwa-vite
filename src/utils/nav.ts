// utils/nav.ts
export const goToEvaluate = (nav: (url:string)=>void, work: { id: string; titulo?: string }) => {
  nav(`/evaluator/evaluate/${work.id}?titulo=${encodeURIComponent(work.titulo || '')}`)
}
