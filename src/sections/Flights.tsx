import { useMemo, useState } from 'react'
import { CalendarClock, Search } from 'lucide-react'
import type { Derived } from '../hooks/useDerived'
import type { Flight } from '../types'
import { BarList, Card, Empty, Grid, Pill, Stat, StatGrid } from '../components/ui'
import { ColumnChart } from '../components/charts'
import { useStore } from '../store/useStore'
import {
  fmtDate,
  fmtDelay,
  fmtDuration,
  fmtKm,
  fmtKmShort,
  fmtNum,
  pct,
  plural,
  WEEKDAYS,
} from '../lib/format'
import { median } from '../lib/stats'
import { airlineIata } from '../lib/refdata'
import type { FlightEvidence, UnloggedFlight } from '../lib/cross'
import { MissingSource } from '../components/MissingSource'
import { AircraftProfile } from '../components/AircraftProfile'
import { AirlineLogo } from '../components/AirlineLogo'

const EVIDENCE: Record<
  FlightEvidence,
  { label: string; tone: 'good' | 'accent' | 'neutral' | 'bad' }
> = {
  flying: { label: 'Confirmed', tone: 'good' },
  airport: { label: 'At airport', tone: 'accent' },
  elsewhere: { label: 'Mismatch', tone: 'bad' },
  nodata: { label: 'No timeline', tone: 'neutral' },
  upcoming: { label: 'Upcoming', tone: 'accent' },
}

export function Flights({ d }: { d: Derived }) {
  const { fStats: s, fd, ref, cross } = d
  const select = useStore((st) => st.select)
  const selection = useStore((st) => st.selection)
  const [q, setQ] = useState('')

  const apLabel = (code: string) => `${code} · ${ref.airports[code]?.city ?? ''}`
  const selFlight = (f: Flight | undefined) => f && select({ type: 'flight', id: f.id })

  const log = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return [...fd.flights]
      .reverse()
      .filter(
        (f) =>
          !needle ||
          [
            f.flightNo,
            f.from,
            f.to,
            f.airlineName,
            f.aircraft,
            f.tail,
            ref.airports[f.from]?.city,
            ref.airports[f.to]?.city,
            f.date,
          ]
            .join(' ')
            .toLowerCase()
            .includes(needle),
      )
  }, [fd.flights, q, ref])

  const evidence = useMemo(() => {
    const m = new Map<FlightEvidence, number>()
    for (const f of fd.flights) {
      const e = cross.matches.get(f.id)?.evidence ?? 'nodata'
      m.set(e, (m.get(e) ?? 0) + 1)
    }
    return m
  }, [fd.flights, cross])
  // Airline stats are keyed by name; logos need the IATA code.
  const airlineCodes = useMemo(() => {
    const m = new Map<string, { icao: string; iata: string | null }>()
    for (const f of fd.flights) {
      if (m.has(f.airlineName)) continue
      m.set(f.airlineName, { icao: f.airline, iata: airlineIata(f.airline, ref.airlines) })
    }
    return m
  }, [fd.flights, ref.airlines])
  const matches = fd.flights.map((f) => cross.matches.get(f.id)!).filter(Boolean)
  const leads = matches.map((m) => m.leadMin).filter((x): x is number => x != null)
  const exits = matches.map((m) => m.exitMin).filter((x): x is number => x != null)

  if (!s.count && !fd.upcoming.length) {
    // No Flighty log at all: fall back to the flights Google Timeline recorded, if any.
    if (!cross.matches.size) {
      const inRange = cross.unlogged.filter((u) => {
        const day = new Date(u.s).toISOString().slice(0, 10)
        return (!d.range.from || day >= d.range.from) && (!d.range.to || day <= d.range.to)
      })
      return (
        <div className="space-y-4">
          {inRange.length > 0 && (
            <Card
              title="Flights in your Google Timeline"
              subtitle={`${plural(inRange.length, 'flight')} · ${fmtKm(inRange.reduce((a, u) => a + u.km, 0))} · airports inferred from where each flight started and ended`}
            >
              <UnloggedList items={inRange} />
            </Card>
          )}
          <Card>
            <MissingSource>
              Import your Flighty CSV for airlines, aircraft, delays, seats and routes
              {d.tl ? ', and to cross-check each flight against your Timeline.' : '.'}
            </MissingSource>
          </Card>
        </div>
      )
    }
    return (
      <Card>
        <Empty>No flights in this selection.</Empty>
      </Card>
    )
  }

  const records: [string, Flight | undefined, string][] = [
    ['Longest distance', s.longest, s.longest ? fmtKm(s.longest.distanceKm) : ''],
    ['Shortest distance', s.shortest, s.shortest ? fmtKm(s.shortest.distanceKm) : ''],
    ['Longest time', s.longestTime, fmtDuration(s.longestTime?.durationMin)],
    ['Shortest time', s.shortestTime, fmtDuration(s.shortestTime?.durationMin)],
    [
      'Fastest (air speed)',
      s.fastest,
      s.fastest ? `${fmtNum(s.speedOf(s.fastest) ?? 0)} km/h` : '',
    ],
    ['Most delayed', s.mostDelayed, fmtDelay(s.mostDelayed?.arrDelayMin)],
    ['Most ahead of schedule', s.earliestArrival, fmtDelay(s.earliestArrival?.arrDelayMin)],
    ['Longest taxi to take-off', s.longestTaxi, fmtDuration(s.longestTaxi?.taxiOutMin)],
    [
      'Biggest time-zone jump',
      s.biggestTzShift,
      s.biggestTzShift
        ? `${s.biggestTzShift.tzShiftH > 0 ? '+' : ''}${s.biggestTzShift.tzShiftH} h`
        : '',
    ],
    ['Earliest departure', s.earliestDeparture, s.earliestDeparture?.depLocalTime ?? ''],
  ]

  return (
    <div className="space-y-4">
      <StatGrid>
        <Stat
          label="Flights"
          value={s.count}
          hint={`${s.domestic} domestic · ${s.count - s.domestic} intl`}
        />
        <Stat
          label="Distance"
          value={fmtKmShort(s.km)}
          hint={`${fmtNum(s.count ? s.km / s.count : 0)} km avg`}
        />
        <Stat
          label="Gate to gate"
          value={fmtDuration(s.minutes)}
          hint={`${(s.minutes / 60 / 24).toFixed(1)} days`}
        />
        <Stat
          label="Airports"
          value={s.airports.length}
          hint={plural(s.countries.size, 'country', 'countries')}
        />
        <Stat
          label="Airlines"
          value={s.airlines.length}
          hint={`${s.aircraft.length} aircraft types`}
        />
        <Stat
          label="On-time arrivals"
          value={pct(s.onTimePct)}
          hint={s.medianDepDelay != null ? `median dep. delay ${fmtDelay(s.medianDepDelay)}` : '—'}
        />
      </StatGrid>

      <Card title="Records" subtitle="Click one to see it on the globe">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {records
            .filter(([, f]) => f)
            .map(([label, f, v]) => (
              <button
                key={label}
                onClick={() => selFlight(f)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:border-accent ${
                  selection?.type === 'flight' && selection.id === f!.id
                    ? 'border-accent bg-surface-2'
                    : 'border-line'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-ink-3">{label}</div>
                  <div className="truncate text-sm font-medium">
                    {f!.from} → {f!.to}{' '}
                    <span className="font-normal text-ink-3">
                      · {f!.flightNo} · {fmtDate(f!.date)}
                    </span>
                  </div>
                </div>
                <span className="tabular text-sm font-semibold">{v}</span>
              </button>
            ))}
        </div>
      </Card>

      <Grid cols="sm:grid-cols-2 2xl:grid-cols-3">
        <Card title="Aircraft" subtitle={`${s.uniqueTails} individual planes recorded`}>
          <BarList
            items={s.aircraft.map(([k, v]) => ({
              key: k,
              label: (
                <>
                  <AircraftProfile name={k} className="mr-2 inline-block h-5 w-14 align-middle" />
                  {k}
                </>
              ),
              value: v,
            }))}
          />
        </Card>
        <Card title="Airlines">
          <BarList
            items={s.airlines.map(([k, v]) => {
              const code = airlineCodes.get(k)
              return {
                key: k,
                label: (
                  <>
                    <span className="mr-2">
                      <AirlineLogo iata={code?.iata ?? null} fallback={code?.icao ?? k} />
                    </span>
                    {k}
                  </>
                ),
                value: v,
              }
            })}
          />
        </Card>
        <Card title="Manufacturers">
          <BarList
            items={s.manufacturers.map(([k, v]) => ({
              key: k,
              label: k,
              value: v,
              display: `${v} · ${pct(v / s.count)}`,
            }))}
          />
        </Card>
        <Card title="Airports" subtitle="Departures + arrivals">
          <BarList
            items={s.airports.map(([k, v]) => ({
              key: k,
              label: (
                <>
                  <span className="mr-1">{ref.countries[ref.airports[k]?.cc]?.flag}</span>
                  {apLabel(k)}
                </>
              ),
              value: v,
              active: selection?.type === 'airport' && selection.code === k,
              onClick: () => select({ type: 'airport', code: k }),
            }))}
          />
        </Card>
        <Card title="Routes" subtitle="Both directions combined">
          <BarList
            items={s.routes.map(([k, v]) => {
              const [a, b] = k.split('–')
              return {
                key: k,
                label: `${a} ⇄ ${b}`,
                value: v,
                active:
                  selection?.type === 'route' &&
                  [selection.from, selection.to].sort().join('–') === k,
                onClick: () => select({ type: 'route', from: a, to: b }),
              }
            })}
          />
        </Card>
        <Card title="Same plane, again" subtitle="Tail numbers you've flown more than once">
          {s.tails.length ? (
            <BarList
              items={s.tails.map(([t, n]) => {
                const f = fd.flights.find((x) => x.tail === t)!
                return {
                  key: t,
                  label: (
                    <>
                      {f.aircraft && (
                        <AircraftProfile
                          name={f.aircraft}
                          className="mr-2 inline-block h-5 w-14 align-middle"
                        />
                      )}
                      {t} · {f.aircraft}
                    </>
                  ),
                  value: n,
                  display: `${n}×`,
                }
              })}
            />
          ) : (
            <Empty>No repeat aircraft in this selection.</Empty>
          )}
        </Card>
      </Grid>

      <Grid>
        <Card title="Departure time" subtitle="Local time at the origin airport">
          <ColumnChart
            data={s.hours.map((v, h) => ({ label: `${String(h).padStart(2, '0')}h`, value: v }))}
            valueLabel="Flights"
            height={170}
          />
          {s.redEyes > 0 && (
            <p className="mt-2 text-xs text-ink-3">
              {plural(s.redEyes, 'red-eye')} (late departure, 2.5 h+)
            </p>
          )}
        </Card>
        <Card title="Day of the week">
          <ColumnChart
            data={s.weekdays.map((v, i) => ({ label: WEEKDAYS[i], value: v }))}
            valueLabel="Flights"
            height={170}
          />
        </Card>
        <Card title="Flights per year">
          <ColumnChart
            data={s.byYear.map(([label, value]) => ({ label, value }))}
            valueLabel="Flights"
            height={170}
          />
        </Card>
        <Card title="On board" subtitle="From the seat & cabin fields you filled in Flighty">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-ink-3">Seat</div>
              <BarList
                items={s.seatTypes.map(([k, v]) => ({
                  key: k,
                  label: k[0].toUpperCase() + k.slice(1),
                  value: v,
                }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-ink-3">Cabin</div>
              <BarList
                items={s.cabins.map(([k, v]) => ({
                  key: k,
                  label: k[0].toUpperCase() + k.slice(1),
                  value: v,
                }))}
              />
            </div>
          </div>
        </Card>
      </Grid>

      <Card
        title="Timeline cross-check"
        subtitle="Each flight matched against Google Timeline: a recorded flight segment, or a visit at the airport"
      >
        {d.tl ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['flying', 'airport', 'elsewhere', 'nodata'] as FlightEvidence[]).map((e) => (
                <Pill key={e} tone={EVIDENCE[e].tone}>
                  {EVIDENCE[e].label}: {evidence.get(e) ?? 0}
                </Pill>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat
                label="Median arrival at airport"
                value={leads.length ? fmtDuration(median(leads)) : '—'}
                hint={`before departure · ${leads.length} flights`}
              />
              <Stat
                label="Median time to leave airport"
                value={exits.length ? fmtDuration(median(exits)) : '—'}
                hint={`after gate arrival · ${exits.length} flights`}
              />
              <Stat
                label="Flights seen by Google"
                value={pct(
                  s.count
                    ? ((evidence.get('flying') ?? 0) + (evidence.get('airport') ?? 0)) / s.count
                    : null,
                )}
                hint="flying segment or airport visit"
              />
            </div>
            {cross.unlogged.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-medium text-ink-3">
                  Flights in your Timeline but not in Flighty
                </h4>
                <UnloggedList items={cross.unlogged} />
              </div>
            )}
          </div>
        ) : (
          <MissingSource>Import your Google Timeline to cross-check flights.</MissingSource>
        )}
      </Card>

      {fd.upcoming.length > 0 && (
        <Card
          title={
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-accent" /> Upcoming flights
            </span>
          }
        >
          <FlightTable flights={fd.upcoming} d={d} />
        </Card>
      )}

      <Card
        title="Flight log"
        subtitle={`${log.length} of ${fd.flights.length} flights`}
        action={
          <label className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search flights"
              className="h-8 w-32 rounded-lg border border-line bg-surface pr-2 pl-7 text-xs focus:border-accent focus:outline-none sm:w-44"
            />
          </label>
        }
      >
        <FlightTable flights={log} d={d} scroll />
      </Card>
    </div>
  )
}

function FlightTable({ flights, d, scroll }: { flights: Flight[]; d: Derived; scroll?: boolean }) {
  const select = useStore((s) => s.select)
  const selection = useStore((s) => s.selection)
  if (!flights.length) return <Empty>No flights match.</Empty>
  return (
    <div className={`-mx-2 overflow-auto ${scroll ? 'max-h-[480px]' : ''}`}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface text-left text-xs text-ink-3">
          <tr>
            <th className="px-2 py-2 font-medium">Date</th>
            <th className="px-2 py-2 font-medium">Route</th>
            <th className="hidden px-2 py-2 font-medium md:table-cell">Flight</th>
            <th className="hidden px-2 py-2 font-medium lg:table-cell">Aircraft</th>
            <th className="px-2 py-2 text-right font-medium">Time</th>
            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Arrival</th>
            <th className="hidden px-2 py-2 font-medium sm:table-cell">Timeline</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f) => {
            const ev = d.cross.matches.get(f.id)?.evidence ?? 'nodata'
            const active = selection?.type === 'flight' && selection.id === f.id
            return (
              <tr
                key={f.id}
                onClick={() => select({ type: 'flight', id: f.id })}
                className={`cursor-pointer border-t border-line hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
              >
                <td className="tabular px-2 py-2 whitespace-nowrap text-ink-2">
                  {fmtDate(f.date)}
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className="font-medium">
                    {f.from} → {f.to}
                  </span>
                  <span className="ml-1.5 hidden text-xs text-ink-3 sm:inline">
                    {fmtKm(f.distanceKm)}
                  </span>
                </td>
                <td className="hidden px-2 py-2 whitespace-nowrap text-ink-2 md:table-cell">
                  {f.flightNo}
                </td>
                <td className="hidden px-2 py-2 text-ink-2 lg:table-cell">
                  {/* Profile from lg; the type name joins it on very wide screens. */}
                  {f.aircraft ? (
                    <span
                      title={f.aircraft}
                      className="inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <AircraftProfile name={f.aircraft} className="h-4 w-11 shrink-0" />
                      <span className="hidden 2xl:inline">{f.aircraft}</span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="tabular px-2 py-2 text-right whitespace-nowrap">
                  {fmtDuration(f.durationMin)}
                </td>
                <td
                  className={`tabular hidden px-2 py-2 text-right whitespace-nowrap sm:table-cell ${
                    (f.arrDelayMin ?? 0) > 15 ? 'text-bad' : 'text-ink-2'
                  }`}
                >
                  {fmtDelay(f.arrDelayMin)}
                </td>
                <td className="hidden px-2 py-2 sm:table-cell">
                  <Pill tone={EVIDENCE[ev].tone}>{EVIDENCE[ev].label}</Pill>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Flights Google Timeline recorded (with inferred airports) that have no Flighty match. */
function UnloggedList({ items }: { items: UnloggedFlight[] }) {
  const select = useStore((st) => st.select)
  return (
    <ul className="divide-y divide-line text-sm">
      {items.map((u) => (
        <li key={u.s} className="flex items-center gap-2 py-1.5">
          <span className="tabular w-28 shrink-0 text-ink-2">{fmtDate(u.s)}</span>
          <button
            className="flex-1 truncate text-left hover:text-accent"
            onClick={() =>
              u.from && u.to
                ? select({ type: 'route', from: u.from.iata, to: u.to.iata })
                : select({ type: 'point', lat: u.b[0], lon: u.b[1], label: 'Arrival' })
            }
          >
            {u.from?.iata ?? '?'} → {u.to?.iata ?? '?'}{' '}
            <span className="text-ink-3">
              {u.from?.city} – {u.to?.city}
            </span>
          </button>
          <span className="tabular text-xs text-ink-2">{fmtKm(u.km)}</span>
        </li>
      ))}
    </ul>
  )
}
