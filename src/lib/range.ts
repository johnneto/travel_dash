import type { DateRange } from '../types'

/** The date range covering one calendar year. */
export const yearRange = (year: string): DateRange => ({
  from: `${year}-01-01`,
  to: `${year}-12-31`,
})

/** The year a range covers exactly, or null for any other range. */
export const rangeYear = (r: DateRange): string | null =>
  r.from?.endsWith('-01-01') && r.to === `${r.from.slice(0, 4)}-12-31` ? r.from.slice(0, 4) : null
