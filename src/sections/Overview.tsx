import { useMemo, useState } from 'react'
import type { Derived } from '../hooks/useDerived'
import { Card, Grid, Segmented, Stat, BarList } from '../components/ui'
import { ColumnChart, StepArea } from '../components/charts'
import { InsightCard } from '../components/InsightCard'
import { CONTINENTS, continentOf } from '../lib/refdata'
import { fmtKm, fmtNum, plural } from '../lib/format'
import { useStore } from '../store/useStore'

type Metric = 'away' | 'trips' | 'flights' | 'countries'

export function Overview({ d }: { d: Derived }) {
  const { ov, fStats, mStats, fd, ref, discovery } = d
  const setTab = useStore((s) => s.setTab)
  const setRange = useStore((s) => s.setRange)
  const hasTimeline = !!d.tl
  const [metric, setMetric] = useState<Metric>(hasTimeline ? 'away' : 'flights')
  const [showAll, setShowAll] = useState(false)

  const perYear = useMemo(() => {
    const m = new Map<string, number>()
    const add = (y: string, n = 1) => m.set(y, (m.get(y) ?? 0) + n)
    if (metric === 'away') fd.days.forEach((x) => x.far >= 100 && add(x.d.slice(0, 4)))
    if (metric === 'trips') fd.trips.forEach((t) => add(t.start.slice(0, 4)))
    if (metric === 'flights') fd.flights.forEach((f) => add(f.date.slice(0, 4)))
    if (metric === 'countries') {
      const s = new Map<string, Set<string>>()
      fd.days.forEach((x) =>
        x.cc.forEach((c) =>
          (s.get(x.d.slice(0, 4)) ?? s.set(x.d.slice(0, 4), new Set()).get(x.d.slice(0, 4))!).add(
            c,
          ),
        ),
      )
      fd.flights.forEach((f) =>
        [f.fromCc, f.toCc].forEach((c) =>
          (
            s.get(f.date.slice(0, 4)) ??
            s.set(f.date.slice(0, 4), new Set()).get(f.date.slice(0, 4))!
          ).add(c),
        ),
      )
      s.forEach((v, k) => m.set(k, v.size))
    }
    return [...m.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value }))
  }, [fd, metric])

  const curve = useMemo(() => {
    const entries = [...discovery.entries()].sort((a, b) => a[1].localeCompare(b[1]))
    const byYear = new Map<string, string[]>()
    for (const [cc, dte] of entries) {
      const y = dte.slice(0, 4)
      byYear.set(y, [...(byYear.get(y) ?? []), cc])
    }
    let total = 0
    return [...byYear.entries()].map(([y, ccs]) => {
      total += ccs.length
      return { label: y, value: total, note: ccs.map((c) => ref.countries[c]?.flag ?? c).join(' ') }
    })
  }, [discovery, ref])

  const continents = useMemo(() => {
    const totals = new Map<string, number>()
    for (const c of Object.values(ref.countries))
      if (c.unMember) totals.set(continentOf(c), (totals.get(continentOf(c)) ?? 0) + 1)
    const visited = new Map<string, number>()
    for (const cc of ov.countries) {
      const k = continentOf(ref.countries[cc])
      visited.set(k, (visited.get(k) ?? 0) + 1)
    }
    return CONTINENTS.filter((k) => k !== 'Antarctica' || visited.has(k)).map((k) => ({
      key: k,
      label: k,
      value: (visited.get(k) ?? 0) / Math.max(1, totals.get(k) ?? 1),
      display: `${visited.get(k) ?? 0} / ${totals.get(k) ?? 0}`,
    }))
  }, [ov.countries, ref])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Stat
          label="Countries"
          value={ov.countries.length}
          hint={plural(ov.continents.size, 'continent')}
          onClick={() => setTab('places')}
        />
        <Stat
          label="Cities & towns"
          value={fmtNum(ov.cities.size)}
          hint={hasTimeline ? `${fmtNum(ov.daysTracked)} days tracked` : 'Needs Timeline data'}
          onClick={() => setTab('places')}
        />
        <Stat
          label="Trips"
          value={fd.trips.length}
          hint={`${fmtNum(ov.daysAway)} days away`}
          onClick={() => setTab('trips')}
        />
        <Stat
          label="Days abroad"
          value={fmtNum(ov.daysAbroad)}
          hint={
            ov.daysTracked
              ? `${Math.round((ov.daysAbroad / ov.daysTracked) * 100)}% of tracked days`
              : '—'
          }
        />
        <Stat
          label="Flights"
          value={fStats.count}
          hint={fmtKm(fStats.km)}
          onClick={() => setTab('flights')}
        />
        <Stat
          label="Ground travel"
          value={fmtKm(mStats.groundKm)}
          hint="car, train, walking…"
          onClick={() => setTab('movement')}
        />
      </div>

      {d.insights.length > 0 && (
        <div>
          <h2 className="mb-2 px-1 text-sm font-semibold text-ink">Did you know?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {(showAll ? d.insights : d.insights.slice(0, 8)).map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
          {d.insights.length > 8 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 w-full rounded-xl border border-line bg-surface py-2 text-sm font-medium text-ink-2 hover:border-accent hover:text-ink"
            >
              {showAll ? 'Show fewer' : `Show ${d.insights.length - 8} more facts`}
            </button>
          )}
        </div>
      )}

      <Grid>
        <Card
          title="Through the years"
          subtitle="Click a year to filter the dashboard"
          action={
            <Segmented<Metric>
              label="Metric"
              value={metric}
              onChange={setMetric}
              options={[
                ...(hasTimeline
                  ? [
                      { value: 'away' as Metric, label: 'Days away' },
                      { value: 'trips' as Metric, label: 'Trips' },
                    ]
                  : []),
                { value: 'flights', label: 'Flights' },
                { value: 'countries', label: 'Countries' },
              ]}
            />
          }
        >
          <ColumnChart
            data={perYear}
            valueLabel={
              { away: 'Days away', trips: 'Trips', flights: 'Flights', countries: 'Countries' }[
                metric
              ]
            }
            onBarClick={(y) => setRange({ from: `${y}-01-01`, to: `${y}-12-31` })}
          />
        </Card>
        <Card
          title="Countries discovered"
          subtitle="Cumulative, all time — hover to see which were new"
        >
          <StepArea data={curve} valueLabel="Countries" />
        </Card>
      </Grid>
      <Card title="Continents" subtitle="Share of UN member states visited per continent">
        <BarList items={continents} max={1} limit={7} />
      </Card>
    </div>
  )
}
