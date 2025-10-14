// aggregator/src/lib/debug.ts
export const isDebug = (flag?: string | boolean) => {
  if (typeof flag === 'boolean') return flag
  if (typeof flag === 'string') return flag === '1' || flag.toLowerCase() === 'true'
  return process.env.DEBUG_AGG_LOG === '1'
}

export function logHeader(title: string) {
  // eslint-disable-next-line no-console
  console.log(`\n===== ${title} =====`)
}

export function logTable(label: string, rows: Record<string, unknown>[] | any[]) {
  // eslint-disable-next-line no-console
  console.log(`\n${label}`)
  // eslint-disable-next-line no-console
  console.table(rows)
}
