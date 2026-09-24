import { useCallback, useMemo, useState } from 'react'
import { ArrowDown, ExternalLink, Home, Search } from 'lucide-react'
import type { Derived } from '../hooks/useDerived'
import { BarList, Card, Empty, Grid, Pill, Segmented } from '../components/ui'
import { useStore } from '../store/useStore'
import { fmtDate, fmtHours, fmtKm, fmtNum } from '../lib/format'
import { continentOf } from '../lib/refdata'
import type { Place } from '../types'
import { PlaceSearch } from '../components/PlaceSearch'
import { normalize } from '../lib/search'
import type { CityStat } from '../lib/stats'
import { useAdmin1 } from '../hooks/useAdmin1'

type SortKey = 'days' | 'name' | 'first' | 'last'
type CitySortKey = SortKey | 'state'

export function Places({ d }: { d: Derived }) {
  const { cStatsAll, ref, tl, cities, places, awayPlaces, ext } = d
  const setCountry = useStore((s) => s.setCountry)
  const country = useStore((s) => s.country)
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const [sort, setSort] = useState<SortKey>('days')
  const [placeMode, setPlaceMode] = useState<'away' | 'all'>('away')

  const rows = useMemo(() => {
    const r = [...cStatsAll.values()].filter((s) => ref.countries[s.cc])
    const cmp: Record<SortKey, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
      days: (a, b) => b.days - a.days || b.flightsIn - a.flightsIn,
      name: (a, b) => ref.countries[a.cc].name.localeCompare(ref.countries[b.cc].name),
      first: (a, b) => a.first.localeCompare(b.first),
      last: (a, b) => b.last.localeCompare(a.last),
    }
    return r.sort(cmp[sort])
  }, [cStatsAll, ref, sort])

  const cityName = (i: number) => (tl && i >= 0 ? tl.cities[i]?.name : '') ?? ''
  const placeLabel = (p: Place) =>
    `${cityName(p.city) || 'Unknown'}${p.cc ? `, ${ref.countries[p.cc]?.name ?? p.cc}` : ''}`

  const topPlaces = (placeMode === 'all' ? places : awayPlaces).slice(0, 10)

  return (
    <div className="space-y-4">
      <PlaceSearch d={d} />
      <Card
        title="Countries"
        subtitle="Days are calendar days with any Timeline presence. Click a country to focus the dashboard on it; click it again to clear."
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
                      aria-selected={country === s.cc}
                      className={`cursor-pointer border-t border-line hover:bg-surface-2 ${country === s.cc ? 'bg-accent/10 font-medium' : ''}`}
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

      {tl && country && <CountryCities d={d} cc={country} />}

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
                    {s.sem !== 'Unknown' && <Pill tone="accent">{s.sem}</Pill>}
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

/** Every city visited in the filtered country, sortable and filterable by name. */
function CountryCities({ d, cc }: { d: Derived; cc: string }) {
  const { cities, ref } = d
  const tl = d.tl!
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const [sort, setSort] = useState<CitySortKey>('days')
  const [q, setQ] = useState('')
  const country = ref.countries[cc]
  const admin1 = useAdmin1()
  const stateOf = useCallback(
    (c: CityStat) => {
      const city = tl.cities[c.idx]
      return (city.admin && admin1?.[`${city.cc}.${city.admin}`]) || ''
    },
    [admin1, tl],
  )

  // Days that crossed a border also list the neighbouring country's cities; keep this one's.
  const inCountry = useMemo(
    () => cities.filter((c) => tl.cities[c.idx]?.cc === cc),
    [cities, tl, cc],
  )
  const rows = useMemo(() => {
    const needle = normalize(q.trim())
    const name = (c: CityStat) => tl.cities[c.idx].name
    const cmp: Record<CitySortKey, (a: CityStat, b: CityStat) => number> = {
      days: (a, b) => b.days - a.days || b.hours - a.hours,
      name: (a, b) => name(a).localeCompare(name(b)),
      // Cities without a known state go last.
      state: (a, b) =>
        (stateOf(a) ? 0 : 1) - (stateOf(b) ? 0 : 1) ||
        stateOf(a).localeCompare(stateOf(b)) ||
        b.days - a.days,
      first: (a, b) => a.first.localeCompare(b.first),
      last: (a, b) => b.last.localeCompare(a.last),
    }
    return inCountry
      .filter(
        (c) =>
          !needle || normalize(name(c)).includes(needle) || normalize(stateOf(c)).includes(needle),
      )
      .sort(cmp[sort])
  }, [inCountry, q, sort, tl, stateOf])

  return (
    <Card
      title={`All cities in ${country?.flag ?? ''} ${country?.name ?? cc}`}
      subtitle={`${fmtNum(inCountry.length)} ${inCountry.length === 1 ? 'city' : 'cities'} in this selection · click one to show it on the globe`}
      action={
        <label className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter city or state"
            aria-label="Filter cities by name or state"
            className="h-8 w-32 rounded-lg border border-line bg-surface pr-2 pl-7 text-xs focus:border-accent focus:outline-none sm:w-44"
          />
        </label>
      }
    >
      {rows.length ? (
        <div className="-mx-2 max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-ink-3">
              <tr>
                <Th sort={sort} setSort={setSort} k="name">
                  City
                </Th>
                <Th sort={sort} setSort={setSort} k="state">
                  State / region
                </Th>
                <Th sort={sort} setSort={setSort} k="days" className="text-right">
                  Days
                </Th>
                <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Time</th>
                <Th sort={sort} setSort={setSort} k="first" className="hidden sm:table-cell">
                  First
                </Th>
                <Th sort={sort} setSort={setSort} k="last">
                  Last
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const active = selection?.type === 'city' && selection.idx === c.idx
                return (
                  <tr
                    key={c.idx}
                    className={`border-t border-line hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
                  >
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => select({ type: 'city', idx: c.idx })}
                        className="text-left font-medium hover:text-accent"
                      >
                        {tl.cities[c.idx].name}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-ink-2">{stateOf(c) || '—'}</td>
                    <td className="tabular px-2 py-1.5 text-right">{fmtNum(c.days)}</td>
                    <td className="tabular hidden px-2 py-1.5 text-right text-ink-2 sm:table-cell">
                      {c.hours ? fmtHours(c.hours) : '—'}
                    </td>
                    <td className="tabular hidden px-2 py-1.5 whitespace-nowrap text-ink-2 sm:table-cell">
                      {fmtDate(c.first)}
                    </td>
                    <td className="tabular px-2 py-1.5 whitespace-nowrap text-ink-2">
                      {fmtDate(c.last)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>{q ? `No cities match “${q.trim()}”.` : 'No cities in this selection.'}</Empty>
      )}
    </Card>
  )
}

function Th<K extends string>({
  k,
  sort,
  setSort,
  children,
  className,
}: {
  k: K
  sort: K
  setSort: (k: K) => void
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
