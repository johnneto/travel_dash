import { useMemo, useState } from 'react'
import { ArrowDown, ExternalLink, Home } from 'lucide-react'
import type { Derived } from '../hooks/useDerived'
import { BarList, Card, Empty, Grid, Pill, Segmented } from '../components/ui'
import { useStore } from '../store/useStore'
import { fmtDate, fmtHours, fmtKm, fmtNum } from '../lib/format'
import { continentOf } from '../lib/refdata'
import type { Place } from '../types'

type SortKey = 'days' | 'name' | 'first' | 'last'

export function Places({ d }: { d: Derived }) {
  const { cStats, ref, tl, cities, places, ext } = d
  const setCountry = useStore((s) => s.setCountry)
  const country = useStore((s) => s.country)
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const [sort, setSort] = useState<SortKey>('days')
  const [placeMode, setPlaceMode] = useState<'away' | 'all'>('away')

  const rows = useMemo(() => {
    const r = [...cStats.values()].filter((s) => ref.countries[s.cc])
    const cmp: Record<SortKey, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
      days: (a, b) => b.days - a.days || b.flightsIn - a.flightsIn,
      name: (a, b) => ref.countries[a.cc].name.localeCompare(ref.countries[b.cc].name),
      first: (a, b) => a.first.localeCompare(b.first),
      last: (a, b) => b.last.localeCompare(a.last),
    }
    return r.sort(cmp[sort])
  }, [cStats, ref, sort])

  const cityName = (i: number) => (tl && i >= 0 ? tl.cities[i]?.name : '') ?? ''
  const placeLabel = (p: Place) =>
    `${cityName(p.city) || 'Unknown'}${p.cc ? `, ${ref.countries[p.cc]?.name ?? p.cc}` : ''}`

  const topPlaces = useMemo(() => {
    if (!tl) return []
    return places
      .filter(
        (s) =>
          placeMode === 'all' ||
          !['Home', 'Inferred Home', 'Work', 'Inferred Work'].includes(tl.places[s.p].sem),
      )
      .slice(0, 10)
  }, [places, tl, placeMode])

  return (
    <div className="space-y-4">
      <Card
        title="Countries"
        subtitle="Days are calendar days with any Timeline presence. Click a row to focus the dashboard on it."
      >
        {rows.length ? (
          <div className="-mx-2 max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-left text-xs text-ink-3">
                <tr>
                  <Th sort={sort} setSort={setSort} k="name">
                    Country
                  </Th>
                  <Th sort={sort} setSort={setSort} k="days" className="text-right">
                    Days
                  </Th>
                  <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Trips</th>
                  <th className="hidden px-2 py-2 text-right font-medium md:table-cell">Cities</th>
                  <Th sort={sort} setSort={setSort} k="first" className="hidden sm:table-cell">
                    First
                  </Th>
                  <Th sort={sort} setSort={setSort} k="last">
                    Last
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const c = ref.countries[s.cc]
                  return (
                    <tr
                      key={s.cc}
                      onClick={() => setCountry(country === s.cc ? null : s.cc)}
                      className={`cursor-pointer border-t border-line hover:bg-surface-2 ${country === s.cc ? 'bg-surface-2' : ''}`}
                    >
                      <td className="px-2 py-2">
                        <span className="mr-1.5">{c.flag}</span>
                        <span className="font-medium">{c.name}</span>
                        <span className="ml-2 hidden text-xs text-ink-3 lg:inline">
                          {continentOf(c)}
                        </span>
                        {s.source === 'flights' && (
                          <span className="ml-2">
                            <Pill>by air</Pill>
                          </span>
                        )}
                      </td>
                      <td className="tabular px-2 py-2 text-right">
                        {s.days ? fmtNum(s.days) : '—'}
                      </td>
                      <td className="tabular hidden px-2 py-2 text-right sm:table-cell">
                        {s.trips || '—'}
                      </td>
                      <td className="tabular hidden px-2 py-2 text-right md:table-cell">
                        {s.cities.size || '—'}
                      </td>
                      <td className="tabular hidden px-2 py-2 whitespace-nowrap text-ink-2 sm:table-cell">
                        {fmtDate(s.first)}
                      </td>
                      <td className="tabular px-2 py-2 whitespace-nowrap text-ink-2">
                        {fmtDate(s.last)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No countries in this selection.</Empty>
        )}
      </Card>

      <Grid>
        <Card title="Top cities" subtitle="By number of days present">
          {tl ? (
            <BarList
              limit={12}
              items={cities.map((s) => ({
                key: String(s.idx),
                label: (
                  <>
                    <span className="mr-1">{ref.countries[tl.cities[s.idx].cc]?.flag}</span>
                    {tl.cities[s.idx].name}
                  </>
                ),
                value: s.days,
                display: `${fmtNum(s.days)} d`,
                active: selection?.type === 'city' && selection.idx === s.idx,
                onClick: () => select({ type: 'city', idx: s.idx }),
              }))}
            />
          ) : (
            <Empty>Import Google Timeline data to see cities.</Empty>
          )}
        </Card>

        <Card
          title="Most visited places"
          subtitle="By total time spent"
          action={
            <Segmented
              label="Places filter"
              value={placeMode}
              onChange={setPlaceMode}
              options={[
                { value: 'away', label: 'Excl. home/work' },
                { value: 'all', label: 'All' },
              ]}
            />
          }
        >
          {tl && topPlaces.length ? (
            <ul className="divide-y divide-line text-sm">
              {topPlaces.map((s) => {
                const p = tl.places[s.p]
                return (
                  <li key={s.p} className="flex items-center gap-2 py-2">
                    <button
                      className="min-w-0 flex-1 truncate text-left hover:text-accent"
                      onClick={() =>
                        select({ type: 'point', lat: p.lat, lon: p.lon, label: cityName(p.city) })
                      }
                    >
                      {placeLabel(p)}
                    </button>
                    {p.sem !== 'Unknown' && <Pill tone="accent">{p.sem}</Pill>}
                    <span className="tabular text-xs text-ink-2">
                      {fmtHours(s.hours)} · {s.visits}×
                    </span>
                    {p.id.startsWith('Ch') && (
                      <a
                        href={`https://www.google.com/maps/place/?q=place_id:${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open in Google Maps"
                        className="text-ink-3 hover:text-accent"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty>No places in this selection.</Empty>
          )}
        </Card>

        <Card title="Extremes" subtitle="The edges of your map in this selection">
          {ext && tl ? (
            <ul className="space-y-2 text-sm">
              {(
                [
                  ['Northernmost', ext.north, `${ext.north.lat.toFixed(2)}°`],
                  ['Southernmost', ext.south, `${ext.south.lat.toFixed(2)}°`],
                  ['Easternmost', ext.east, `${ext.east.lon.toFixed(2)}°`],
                  ['Westernmost', ext.west, `${ext.west.lon.toFixed(2)}°`],
                  ['Farthest from home', ext.farthest.place, fmtKm(ext.farthest.km)],
                ] as const
              ).map(([label, p, v]) => (
                <li key={label}>
                  <button
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2"
                    onClick={() =>
                      select({ type: 'point', lat: p.lat, lon: p.lon, label: cityName(p.city) })
                    }
                  >
                    <span className="w-36 shrink-0 text-xs text-ink-3">{label}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {ref.countries[p.cc]?.flag} {cityName(p.city) || 'Unknown'}
                    </span>
                    <span className="tabular text-xs text-ink-2">{v}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Needs Timeline data.</Empty>
          )}
        </Card>

        <Card
          title="Where you lived"
          subtitle="Detected from Timeline 'Home' labels, month by month"
        >
          {tl?.homes.length ? (
            <ol className="relative space-y-2 border-l border-line pl-4 text-sm">
              {[...tl.homes].reverse().map((h) => (
                <li key={h.from} className="relative">
                  <span className="absolute top-1.5 -left-[21px] grid h-2.5 w-2.5 place-items-center rounded-full bg-accent" />
                  <button
                    onClick={() =>
                      select({ type: 'point', lat: h.lat, lon: h.lon, label: cityName(h.city) })
                    }
                    className="flex items-center gap-1.5 font-medium hover:text-accent"
                  >
                    <Home className="h-3.5 w-3.5 text-ink-3" />
                    {ref.countries[tl.cities[h.city]?.cc]?.flag} {cityName(h.city)}
                  </button>
                  <div className="text-xs text-ink-3">
                    {fmtDate(`${h.from}-01`, 'month')} – {fmtDate(`${h.to}-01`, 'month')}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Needs Timeline data.</Empty>
          )}
        </Card>
      </Grid>
    </div>
  )
}

function Th({
  k,
  sort,
  setSort,
  children,
  className,
}: {
  k: SortKey
  sort: SortKey
  setSort: (k: SortKey) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <th className={`px-2 py-2 font-medium ${className ?? ''}`}>
      <button
        onClick={() => setSort(k)}
        className={`inline-flex items-center gap-1 ${sort === k ? 'text-ink' : 'hover:text-ink'}`}
      >
        {children}
        {sort === k && <ArrowDown className="h-3 w-3" />}
      </button>
    </th>
  )
}
