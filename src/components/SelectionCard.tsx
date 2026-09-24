import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Derived } from '../hooks/useDerived'
import { useStore } from '../store/useStore'
import { fmtDate, fmtDelay, fmtDuration, fmtKm, fmtNum, plural } from '../lib/format'
import { routeKey } from '../lib/stats'
import { Pill } from './ui'

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex justify-between gap-3 text-xs">
    <span className="text-ink-3">{k}</span>
    <span className="tabular truncate text-right text-ink">{v}</span>
  </div>
)

export function SelectionCard({ d }: { d: Derived }) {
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const setCountry = useStore((s) => s.setCountry)
  const country = useStore((s) => s.country)
  const { ref, tl, fd, cross } = d
  if (!selection) return null

  let title: ReactNode = null
  let body: ReactNode = null
  const all = [...fd.flights, ...fd.upcoming]

  switch (selection.type) {
    case 'country': {
      const c = ref.countries[selection.cc]
      const s = d.cStats.get(selection.cc)
      title = `${c?.flag ?? ''} ${c?.name ?? selection.cc}`
      body = s ? (
        <>
          <Row k="Days" v={fmtNum(s.days)} />
          <Row k="Trips" v={s.trips} />
          <Row k="Cities" v={s.cities.size} />
          <Row k="Flights in" v={s.flightsIn} />
          <Row k="First / last" v={`${fmtDate(s.first)} – ${fmtDate(s.last)}`} />
        </>
      ) : (
        <p className="text-xs text-ink-3">Not visited in this period.</p>
      )
      break
    }
    case 'flight': {
      const f = all.find((x) => x.id === selection.id)
      if (!f) return null
      const m = cross.matches.get(f.id)
      title = `${f.from} → ${f.to}`
      body = (
        <>
          <Row k={f.flightNo} v={`${f.airlineName} · ${fmtDate(f.date)}`} />
          <Row k="Route" v={`${ref.airports[f.from]?.city} – ${ref.airports[f.to]?.city}`} />
          <Row k="Aircraft" v={`${f.aircraft || '—'}${f.tail ? ` · ${f.tail}` : ''}`} />
          <Row k="Distance" v={fmtKm(f.distanceKm)} />
          <Row
            k="Gate to gate"
            v={`${fmtDuration(f.durationMin)}${f.airMin ? ` (air ${fmtDuration(f.airMin)})` : ''}`}
          />
          <Row
            k="Departure / arrival"
            v={`${fmtDelay(f.depDelayMin)} / ${fmtDelay(f.arrDelayMin)}`}
          />
          {f.seat && <Row k="Seat" v={`${f.seat} ${f.seatType}`} />}
          {m?.leadMin != null && <Row k="At airport before" v={fmtDuration(m.leadMin)} />}
          {m?.exitMin != null && <Row k="Left airport after" v={fmtDuration(m.exitMin)} />}
          {m?.tripId != null && tl && (
            <button
              className="mt-1 text-xs font-medium text-accent"
              onClick={() => select({ type: 'trip', id: m.tripId! })}
            >
              Part of a {tl.trips[m.tripId].days}-day trip →
            </button>
          )}
        </>
      )
      break
    }
    case 'route': {
      const k = [selection.from, selection.to].sort().join('–')
      const fl = fd.flights.filter((f) => routeKey(f) === k)
      title = `${selection.from} ⇄ ${selection.to}`
      body = (
        <>
          <Row
            k="Cities"
            v={`${ref.airports[selection.from]?.city} – ${ref.airports[selection.to]?.city}`}
          />
          <Row k="Flights" v={fl.length || 'not in Flighty'} />
          {fl[0] && <Row k="Distance" v={fmtKm(fl[0].distanceKm)} />}
          {fl.length > 0 && (
            <Row k="Airlines" v={[...new Set(fl.map((f) => f.airlineName))].join(', ')} />
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {fl.slice(-8).map((f) => (
              <button key={f.id} onClick={() => select({ type: 'flight', id: f.id })}>
                <Pill>{fmtDate(f.date)}</Pill>
              </button>
            ))}
          </div>
        </>
      )
      break
    }
    case 'airport': {
      const a = ref.airports[selection.code]
      const deps = fd.flights.filter((f) => f.from === selection.code).length
      const arrs = fd.flights.filter((f) => f.to === selection.code).length
      title = `${ref.countries[a?.cc]?.flag ?? ''} ${selection.code}`
      body = (
        <>
          <p className="text-xs text-ink-2">{a?.name}</p>
          <Row k="Departures" v={deps} />
          <Row k="Arrivals" v={arrs} />
        </>
      )
      break
    }
    case 'trip': {
      const t = tl?.trips[selection.id]
      if (!t || !tl) return null
      const flights = (cross.tripFlights.get(t.id) ?? [])
        .map((id) => all.find((f) => f.id === id))
        .filter(Boolean)
      title = `${tl.cities[t.mainCity]?.name ?? 'Trip'} ${t.countries.map((c) => ref.countries[c]?.flag).join('')}`
      body = (
        <>
          <Row k="Dates" v={`${fmtDate(t.start)} – ${fmtDate(t.end)}`} />
          <Row k="Length" v={plural(t.days, 'day')} />
          <Row k="Max from home" v={fmtKm(t.maxKm)} />
          {t.cities.length > 0 && (
            <p className="text-xs text-ink-2">
              {t.cities
                .slice(0, 10)
                .map((c) => tl.cities[c].name)
                .join(' → ')}
            </p>
          )}
          {flights.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {flights.map((f) => (
                <button key={f!.id} onClick={() => select({ type: 'flight', id: f!.id })}>
                  <Pill tone="accent">
                    {f!.from}→{f!.to}
                  </Pill>
                </button>
              ))}
            </div>
          )}
        </>
      )
      break
    }
    case 'city': {
      const c = tl?.cities[selection.idx]
      const s = d.cities.find((x) => x.idx === selection.idx)
      if (!c) return null
      title = `${ref.countries[c.cc]?.flag ?? ''} ${c.name}`
      body = s ? (
        <>
          <Row k="Days" v={s.days} />
          <Row k="Visits" v={`${s.visits} · ${fmtNum(s.hours)} h`} />
          <Row k="First / last" v={`${fmtDate(s.first)} – ${fmtDate(s.last)}`} />
        </>
      ) : null
      break
    }
    case 'point':
      title = selection.label || 'Location'
      body = <Row k="Coordinates" v={`${selection.lat.toFixed(3)}, ${selection.lon.toFixed(3)}`} />
  }

  return (
    <div className="pointer-events-auto w-full max-w-xs rounded-xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          onClick={() =>
            selection.type === 'country' && country === selection.cc
              ? setCountry(null)
              : select(null)
          }
          aria-label="Clear selection"
          className="text-ink-3 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1">{body}</div>
    </div>
  )
}
