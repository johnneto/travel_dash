import type { Airport, Flight, TimelineData, Trip } from '../types'
import { haversineKm } from './geo'

export type FlightEvidence = 'flying' | 'airport' | 'elsewhere' | 'nodata' | 'upcoming'

export interface FlightMatch {
  flightId: string
  evidence: FlightEvidence
  /** Minutes from gate arrival until you left the airport (first ground movement). */
  exitMin: number | null
  /** Minutes you were at the departure airport before gate departure. */
  leadMin: number | null
  tripId: number | null
}

export interface UnloggedFlight {
  s: number
  e: number
  km: number
  from: Airport | null
  to: Airport | null
  a: [number, number]
  b: [number, number]
}

export interface CrossData {
  matches: Map<string, FlightMatch>
  unlogged: UnloggedFlight[]
  tripFlights: Map<number, string[]>
}

const HOUR = 3600000

function nearestAirport(lat: number, lon: number, airports: Airport[], maxKm = 60): Airport | null {
  let best: Airport | null = null
  let bestD = maxKm
  for (const a of airports) {
    if (Math.abs(a.lat - lat) > 1 || Math.abs(a.lon - lon) > 1.5) continue
    const d = haversineKm(lat, lon, a.lat, a.lon)
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  return best
}

/** First index in a list sorted by `s` whose `s >= t`. */
function lowerBound<T extends { s: number }>(arr: T[], t: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (arr[m].s < t) lo = m + 1
    else hi = m
  }
  return lo
}

/**
 * Cross-reference Flighty flights with Google Timeline:
 *  - confirm each flight with a timeline "flying" segment or a visit at the airport
 *  - measure how early you get to the airport and how long it takes to leave it
 *  - find flights the timeline saw that are missing from Flighty
 *  - attach flights to detected trips
 */
export function crossReference(
  flights: Flight[],
  tl: TimelineData | null,
  airports: Record<string, Airport>,
  now = Date.now(),
): CrossData {
  const matches = new Map<string, FlightMatch>()
  const tripFlights = new Map<number, string[]>()
  const unlogged: UnloggedFlight[] = []

  const tripFor = (date: string): Trip | undefined =>
    tl?.trips.find((t) => date >= t.start && date <= t.end)

  const flying = tl ? tl.activities.filter((a) => a.mode === 'flying') : []
  const used = new Set<number>()

  for (const f of flights) {
    const trip = tripFor(f.date)
    if (trip) {
      const list = tripFlights.get(trip.id) ?? []
      list.push(f.id)
      tripFlights.set(trip.id, list)
    }
    const m: FlightMatch = {
      flightId: f.id,
      evidence: 'nodata',
      exitMin: null,
      leadMin: null,
      tripId: trip?.id ?? null,
    }
    matches.set(f.id, m)
    if (f.dep == null || f.arr == null) continue
    if (f.dep > now) {
      m.evidence = 'upcoming'
      continue
    }
    if (!tl) continue
    const A = airports[f.from]
    const B = airports[f.divertedTo ?? f.to] ?? airports[f.to]

    // 1. a "flying" activity overlapping the flight
    const fi = flying.findIndex((a) => a.s < f.arr! + 2 * HOUR && a.e > f.dep! - 2 * HOUR)
    if (fi >= 0) {
      used.add(fi)
      m.evidence = 'flying'
    }

    // 2. any timeline data near the airports around the flight
    const lo = lowerBound(tl.visits, f.dep - 6 * HOUR)
    let sawAirport = false
    let sawAnything = false
    for (let i = lo; i < tl.visits.length && tl.visits[i].s < f.arr + 6 * HOUR; i++) {
      const v = tl.visits[i]
      const pl = tl.places[v.p]
      sawAnything = true
      const nearA = A && haversineKm(pl.lat, pl.lon, A.lat, A.lon) < 5
      const nearB = B && haversineKm(pl.lat, pl.lon, B.lat, B.lon) < 5
      if (nearA || nearB) sawAirport = true
      if (nearA && v.s < f.dep && v.e > f.dep - 6 * HOUR) {
        const lead = Math.round((f.dep - v.s) / 60000)
        if (lead > 0 && lead < 6 * 60) m.leadMin = Math.max(m.leadMin ?? 0, lead)
      }
      if (nearB && v.e > f.arr && v.s < f.arr + 3 * HOUR) {
        const exit = Math.round((v.e - f.arr) / 60000)
        if (exit >= 0 && exit < 4 * 60) m.exitMin = exit
      }
    }
    if (m.evidence !== 'flying')
      m.evidence = sawAirport ? 'airport' : sawAnything ? 'elsewhere' : 'nodata'
  }

  // Flights the timeline recorded that Flighty does not have.
  if (tl) {
    const apList = Object.values(airports)
    flying.forEach((a, i) => {
      if (used.has(i) || a.km < 150) return
      const covered = flights.some(
        (f) => f.dep != null && f.arr != null && a.s < f.arr + 3 * HOUR && a.e > f.dep - 3 * HOUR,
      )
      if (covered) return
      unlogged.push({
        s: a.s,
        e: a.e,
        km: Math.round(a.km),
        a: a.a,
        b: a.b,
        from: nearestAirport(a.a[0], a.a[1], apList),
        to: nearestAirport(a.b[0], a.b[1], apList),
      })
    })
  }

  return { matches, unlogged, tripFlights }
}
