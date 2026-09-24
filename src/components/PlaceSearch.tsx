import { useDeferredValue, useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import clsx from 'clsx'
import type { Derived } from '../hooks/useDerived'
import { useStore } from '../store/useStore'
import { searchPlaces, type PlaceSearchResult } from '../lib/search'
import { fmtDate, fmtHours, fmtNum, plural } from '../lib/format'
import { Card, Empty, Pill } from './ui'

const PREVIEW = 3

/** Search the cities and places in the Google Timeline by city, country, continent or type. */
export function PlaceSearch({ d }: { d: Derived }) {
  const { tl, cities, places, ref } = d
  const [q, setQ] = useState('')
  const query = useDeferredValue(q)
  const results = useMemo(
    () => (tl ? searchPlaces(query, tl, cities, places, ref.countries) : []),
    [query, tl, cities, places, ref.countries],
  )
  if (!tl) return null

  return (
    <Card
      title="Search places"
      subtitle="Find where you've been by city, country, continent or place type (Home, Work…)"
    >
      <label className="relative block">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Lisbon, Japan, South America, work"
          aria-label="Search places"
          className="h-10 w-full rounded-lg border border-line bg-surface pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
        />
      </label>
      {query.trim() &&
        (results.length ? (
          <ul className="mt-3 max-h-[480px] divide-y divide-line overflow-auto">
            {results.map((r) => (
              <ResultRow key={r.city.idx} r={r} d={d} />
            ))}
          </ul>
        ) : (
          <Empty>No places match “{query.trim()}” in this selection.</Empty>
        ))}
    </Card>
  )
}

function ResultRow({ r, d }: { r: PlaceSearchResult; d: Derived }) {
  const { ref } = d
  const tl = d.tl!
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  const [expanded, setExpanded] = useState(false)
  const city = tl.cities[r.city.idx]
  const country = ref.countries[city.cc]
  const shown = expanded ? r.places : r.places.slice(0, PREVIEW)
  const active = selection?.type === 'city' && selection.idx === r.city.idx

  return (
    <li className="py-2.5">
      <button
        onClick={() => select({ type: 'city', idx: r.city.idx })}
        aria-pressed={active}
        className="flex w-full items-baseline gap-2 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium hover:text-accent">
          <span className="mr-1">{country?.flag}</span>
          <span className={clsx(active && 'text-accent')}>{city.name}</span>
          <span className="font-normal text-ink-3"> · {country?.name ?? city.cc}</span>
        </span>
        <span className="tabular shrink-0 text-xs text-ink-2">
          {plural(r.city.days, 'day')} · {fmtDate(r.city.first, 'month')}
          {r.city.first.slice(0, 7) !== r.city.last.slice(0, 7) &&
            ` – ${fmtDate(r.city.last, 'month')}`}
        </span>
      </button>
      {shown.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-6">
          {shown.map((s) => {
            const p = tl.places[s.p]
            return (
              <li key={s.p} className="flex items-center gap-2 text-xs">
                <button
                  onClick={() =>
                    select({ type: 'point', lat: p.lat, lon: p.lon, label: city.name })
                  }
                  className="tabular min-w-0 flex-1 truncate text-left text-ink-2 hover:text-accent"
                >
                  {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                  <span className="text-ink-3">
                    {' '}
                    · {fmtHours(s.hours)} · {s.visits}× · last {fmtDate(s.last)}
                  </span>
                </button>
                {s.sem !== 'Unknown' && <Pill tone="accent">{s.sem}</Pill>}
                <a
                  href={
                    p.id.startsWith('Ch')
                      ? `https://www.google.com/maps/place/?q=place_id:${p.id}`
                      : `https://www.google.com/maps?q=${p.lat},${p.lon}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open in Google Maps"
                  className="text-ink-3 hover:text-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            )
          })}
        </ul>
      )}
      {r.places.length > PREVIEW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 pl-6 text-xs font-medium text-accent hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${fmtNum(r.places.length)} places`}
        </button>
      )}
    </li>
  )
}
