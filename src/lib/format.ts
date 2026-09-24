const nf = new Intl.NumberFormat('en-GB')
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

export const fmtNum = (n: number) => nf.format(Math.round(n))
export const fmtNum1 = (n: number) => nf1.format(n)

export function fmtKm(km: number): string {
  if (km >= 100000) return `${nf1.format(km / 1000)}k km`
  return `${nf.format(Math.round(km))} km`
}

export function fmtDuration(min: number | null | undefined): string {
  if (min == null) return '—'
  const m = Math.round(Math.abs(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  const s = h ? `${h}h${r ? ` ${String(r).padStart(2, '0')}m` : ''}` : `${r}m`
  return min < 0 ? `-${s}` : s
}

export function fmtHours(h: number): string {
  if (h >= 48) return `${nf.format(Math.round(h / 24))} days`
  if (h >= 1) return `${nf1.format(h)} h`
  return `${Math.round(h * 60)} min`
}

export function fmtDate(
  d: string | number | null | undefined,
  opts: 'short' | 'long' | 'month' = 'short',
): string {
  if (d == null) return '—'
  const date = typeof d === 'number' ? new Date(d) : new Date(`${d.slice(0, 10)}T12:00:00Z`)
  if (opts === 'month')
    return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...(opts === 'long' ? { weekday: 'short' } : {}),
  })
}

export function fmtDelay(min: number | null | undefined): string {
  if (min == null) return '—'
  if (Math.abs(min) < 1) return 'on time'
  return min > 0 ? `+${fmtDuration(min)}` : `${fmtDuration(-min)} early`
}

export const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`)

export const plural = (n: number, word: string, pluralWord = `${word}s`) =>
  `${fmtNum(n)} ${n === 1 ? word : pluralWord}`

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
