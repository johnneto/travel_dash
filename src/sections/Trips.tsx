import { useMemo } from 'react'
import { Plane } from 'lucide-react'
import type { Derived } from '../hooks/useDerived'
import { BarList, Card, Empty, Grid, Stat } from '../components/ui'
import { Heatmap } from '../components/charts'
import { useStore } from '../store/useStore'
import { fmtDate, fmtKm, fmtNum, plural, WEEKDAYS } from '../lib/format'
import { median } from '../lib/stats'
import { AWAY_KM } from '../lib/process/timeline'

const BUCKETS: [string, number, number][] = [
  ['Day trip', 1, 1],
  ['Weekend (2–3 days)', 2, 3],
  ['4–7 days', 4, 7],
  ['1–2 weeks', 8, 14],
  ['2–4 weeks', 15, 30],
  ['Over a month', 31, 10000],
]

export function Trips({ d }: { d: Derived }) {
  const { fd, tl, ref, cross } = d
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)

  const heat = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of fd.days)
      if (x.far >= AWAY_KM) m.set(x.d.slice(0, 7), (m.get(x.d.slice(0, 7)) ?? 0) + 1)
    const years = [...new Set(fd.days.map((x) => x.d.slice(0, 4)))].sort().reverse()
    return { m, years }
  }, [fd.days])

  if (!tl) {
    return (
      <Card>
        <Empty>Trips are detected from Google Timeline data — import it to see them.</Empty>
      </Card>
    )
  }
  const trips = [...fd.trips].reverse()
  const lengths = fd.trips.map((t) => t.days)
  const longest = [...fd.trips].sort((a, b) => b.days - a.days)[0]
  const startDays = Array.from({ length: 7 }, () => 0)
  for (const t of fd.trips) startDays[(new Date(`${t.start}T12:00:00Z`).getUTCDay() + 6) % 7]++
  const cityName = (i: number) => (i >= 0 ? tl.cities[i]?.name : undefined)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Trips" value={fd.trips.length} hint={`more than ${AWAY_KM} km from home`} />
        <Stat
          label="Median length"
          value={lengths.length ? plural(median(lengths)!, 'day') : '—'}
        />
        <Stat
          label="Longest trip"
          value={longest ? plural(longest.days, 'day') : '—'}
          hint={longest ? cityName(longest.mainCity) : undefined}
          onClick={longest ? () => select({ type: 'trip', id: longest.id }) : undefined}
        />
        <Stat
          label="Days away"
          value={fmtNum(fd.days.filter((x) => x.far >= AWAY_KM).length)}
          hint="in this selection"
        />
      </div>

      <Card
        title="Days away from home"
        subtitle="Month by month — darker means more days travelling"
      >
        <Heatmap cells={heat.m} years={heat.years} unit="days away" />
      </Card>

      <Grid>
        <Card title="Trip length">
          <BarList
            items={BUCKETS.map(([label, lo, hi]) => ({
              key: label,
              label,
              value: lengths.filter((l) => l >= lo && l <= hi).length,
            }))}
          />
        </Card>
        <Card title="Trips start on…">
          <BarList
            items={startDays.map((v, i) => ({ key: WEEKDAYS[i], label: WEEKDAYS[i], value: v }))}
            limit={7}
          />
        </Card>
      </Grid>

      <Card title="All trips" subtitle="Click a trip to trace it on the globe">
        {trips.length ? (
          <ul className="-mx-2 max-h-[640px] divide-y divide-line overflow-auto">
            {trips.map((t) => {
              const flights = cross.tripFlights.get(t.id)?.length ?? 0
              const active = selection?.type === 'trip' && selection.id === t.id
              const title =
                cityName(t.mainCity) ??
                ref.countries[
                  t.countries.find((c) => c !== tl.cities[t.home]?.cc) ?? t.countries[0]
                ]?.name ??
                'Trip'
              return (
                <li key={t.id}>
                  <button
                    onClick={() => select({ type: 'trip', id: t.id })}
                    className={`flex w-full items-start gap-3 px-2 py-2.5 text-left hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
                  >
                    <div className="w-16 shrink-0 text-center">
                      <div className="tabular text-lg leading-none font-semibold">{t.days}</div>
                      <div className="text-[11px] text-ink-3">{t.days === 1 ? 'day' : 'days'}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                        <span>{title}</span>
                        <span className="text-base leading-none">
                          {t.countries.map((c) => ref.countries[c]?.flag).join(' ')}
                        </span>
                      </div>
                      <div className="text-xs text-ink-3">
                        {fmtDate(t.start)} – {fmtDate(t.end)} · up to {fmtKm(t.maxKm)} from home
                        {flights > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            · <Plane className="h-3 w-3" /> {flights}
                          </span>
                        )}
                      </div>
                      {t.cities.length > 1 && (
                        <div className="mt-0.5 truncate text-xs text-ink-2">
                          {t.cities
                            .slice(0, 8)
                            .map((c) => cityName(c))
                            .join(' → ')}
                          {t.cities.length > 8 ? ` +${t.cities.length - 8}` : ''}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <Empty>No trips in this selection.</Empty>
        )}
      </Card>
    </div>
  )
}
