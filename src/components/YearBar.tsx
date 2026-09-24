import { useMemo } from 'react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import { rangeYear, yearRange } from '../lib/range'

/**
 * "All time" followed by every year with imported data, oldest first. Picking one sets the
 * dashboard's period, so every section and the globe follow.
 */
export function YearBar() {
  const data = useStore((s) => s.data)
  const range = useStore((s) => s.range)
  const setRange = useStore((s) => s.setRange)

  const years = useMemo(() => {
    const ys = new Set<string>()
    data.flights.forEach((f) => ys.add(f.date.slice(0, 4)))
    data.timeline?.days.forEach((d) => ys.add(d.d.slice(0, 4)))
    return [...ys].sort()
  }, [data])

  const year = rangeYear(range)
  const options = [
    { key: 'all', label: 'All time', active: !range.from && !range.to },
    ...years.map((y) => ({ key: y, label: y, active: year === y })),
  ]

  return (
    <div className="mb-4 overflow-x-auto [scrollbar-width:none]">
      <div
        role="radiogroup"
        aria-label="Year"
        className="inline-flex gap-0.5 rounded-xl bg-surface-2 p-1"
      >
        {options.map((o) => (
          <button
            key={o.key}
            role="radio"
            aria-checked={o.active}
            onClick={() => setRange(o.key === 'all' ? { from: null, to: null } : yearRange(o.key))}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition',
              o.active ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
