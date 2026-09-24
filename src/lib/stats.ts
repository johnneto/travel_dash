import type {
  Activity,
  CountryInfo,
  DateRange,
  Day,
  Flight,
  TimelineData,
  TravelMode,
  Trip,
  Visit,
} from '../types'
import { continentOf } from './refdata'
import { haversineKm } from './geo'
import { localDate } from './process/timeline'

export interface Filters {
  range: DateRange
  country: string | null
}

export interface Filtered {
  flights: Flight[] // flown (past, not canceled)
  upcoming: Flight[]
  days: Day[]
  visits: Visit[]
  activities: Activity[]
  trips: Trip[]
}

const inRange = (d: string, r: DateRange) => (!r.from || d >= r.from) && (!r.to || d <= r.to)

export function applyFilters(
  flights: Flight[],
  tl: TimelineData | null,
  f: Filters,
  now = Date.now(),
): Filtered {
  const today = new Date(now).toISOString().slice(0, 10)
  const cc = f.country
  const flightOk = (x: Flight) =>
    inRange(x.date, f.range) && (!cc || x.fromCc === cc || x.toCc === cc)
  const flown = flights.filter((x) => !x.canceled && (x.dep ?? 0) <= now && x.date <= today)
  const upcoming = flights.filter((x) => !x.canceled && ((x.dep ?? 0) > now || x.date > today))
  if (!tl) {
    return {
      flights: flown.filter(flightOk),
      upcoming: upcoming.filter((x) => !cc || x.fromCc === cc || x.toCc === cc),
      days: [],
      visits: [],
      activities: [],
      trips: [],
    }
  }
  const days = tl.days.filter((d) => inRange(d.d, f.range) && (!cc || d.cc.includes(cc)))
  const visits = tl.visits.filter(
    (v) => inRange(localDate(v.s, v.off), f.range) && (!cc || tl.places[v.p].cc === cc),
  )
  const activities = tl.activities.filter(
    (a) => inRange(localDate(a.s, a.off), f.range) && (!cc || a.ccA === cc || a.ccB === cc),
  )
  const trips = tl.trips.filter(
    (t) =>
      (!f.range.from || t.end >= f.range.from) &&
      (!f.range.to || t.start <= f.range.to) &&
      (!cc || t.countries.includes(cc)),
  )
  return {
    flights: flown.filter(flightOk),
    upcoming: upcoming.filter((x) => !cc || x.fromCc === cc || x.toCc === cc),
    days,
    visits,
    activities,
    trips,
  }
}

// ---------------------------------------------------------------------------
export function countBy<T>(arr: T[], key: (x: T) => string | null | undefined) {
  const m = new Map<string, number>()
  for (const x of arr) {
    const k = key(x)
    if (!k) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// ---------------------------------------------------------------------------
export interface CountryStat {
  cc: string
  days: number
  first: string
  last: string
  trips: number
  cities: Set<number>
  flightsIn: number
  source: 'timeline' | 'flights' | 'both'
}

export function countryStats(fd: Filtered, tl: TimelineData | null): Map<string, CountryStat> {
  const m = new Map<string, CountryStat>()
  const get = (cc: string, d: string) => {
    let s = m.get(cc)
    if (!s) {
      s = {
        cc,
        days: 0,
        first: d,
        last: d,
        trips: 0,
        cities: new Set(),
        flightsIn: 0,
        source: 'timeline',
      }
      m.set(cc, s)
    }
    if (d < s.first) s.first = d
    if (d > s.last) s.last = d
    return s
  }
  for (const d of fd.days) {
    for (const cc of d.cc) {
      const s = get(cc, d.d)
      s.days++
    }
    if (tl) for (const ci of d.ci) m.get(tl.cities[ci]?.cc)?.cities.add(ci)
  }
  for (const t of fd.trips) for (const cc of t.countries) if (m.has(cc)) m.get(cc)!.trips++
  for (const f of fd.flights) {
    for (const cc of new Set([f.fromCc, f.toCc])) {
      const had = m.has(cc)
      const s = get(cc, f.date)
      if (!had) s.source = 'flights'
      else if (s.source === 'timeline' && s.days > 0) s.source = 'both'
    }
    m.get(f.toCc)!.flightsIn++
  }
  return m
}

export interface CityStat {
  idx: number
  days: number
  hours: number
  visits: number
  first: string
  last: string
}

export function cityStats(fd: Filtered, tl: TimelineData | null): CityStat[] {
  if (!tl) return []
  const m = new Map<number, CityStat>()
  for (const d of fd.days) {
    for (const ci of d.ci) {
      let s = m.get(ci)
      if (!s) m.set(ci, (s = { idx: ci, days: 0, hours: 0, visits: 0, first: d.d, last: d.d }))
      s.days++
      if (d.d < s.first) s.first = d.d
      if (d.d > s.last) s.last = d.d
    }
  }
  for (const v of fd.visits) {
    const s = m.get(tl.places[v.p].city)
    if (!s) continue
    s.visits++
    s.hours += (v.e - v.s) / 3600000
  }
  return [...m.values()].sort((a, b) => b.days - a.days || b.hours - a.hours)
}

/** Place labels Google gives the user's own Home / Work (and its guesses at them). */
export const HOME_WORK_SEMANTICS = new Set(['Home', 'Inferred Home', 'Work', 'Inferred Work'])

export interface PlaceStat {
  p: number
  hours: number
  visits: number
  /** Start of the first and last visit (UTC epoch ms). */
  first: number
  last: number
  /** Label of the latest labelled visit ('Unknown' if none). Labels are per visit, so a place
   * that was Home back then and isn't any more reads as what it is now. */
  sem: string
  /** Every label the place had across the counted visits. */
  sems: string[]
}
/** Per-place totals over the given visits, optionally only those matching `keep`. */
export function placeStats(visits: Visit[], keep?: (v: Visit) => boolean): PlaceStat[] {
  const m = new Map<number, PlaceStat>()
  const semAt = new Map<number, number>() // start of the visit `sem` was taken from
  for (const v of visits) {
    if (keep && !keep(v)) continue
    let s = m.get(v.p)
    if (!s)
      m.set(
        v.p,
        (s = { p: v.p, hours: 0, visits: 0, first: v.s, last: v.s, sem: 'Unknown', sems: [] }),
      )
    s.visits++
    s.hours += (v.e - v.s) / 3600000
    if (v.s < s.first) s.first = v.s
    if (v.s > s.last) s.last = v.s
    if (v.sem !== 'Unknown') {
      if (!s.sems.includes(v.sem)) s.sems.push(v.sem)
      if (v.s > (semAt.get(v.p) ?? -Infinity)) {
        s.sem = v.sem
        semAt.set(v.p, v.s)
      }
    }
  }
  return [...m.values()].sort((a, b) => b.hours - a.hours)
}

export function extremes(fd: Filtered, tl: TimelineData | null) {
  if (!tl || !fd.visits.length) return null
  const ps = [...new Set(fd.visits.map((v) => v.p))].map((p) => tl.places[p])
  const by = (f: (a: (typeof ps)[0], b: (typeof ps)[0]) => number) => [...ps].sort(f)[0]
  let farthest = { place: ps[0], km: 0 }
  for (const v of fd.visits) {
    const pl = tl.places[v.p]
    const d = localDate(v.s, v.off)
    const h = tl.homes.find((x) => d.slice(0, 7) >= x.from && d.slice(0, 7) <= x.to) ?? tl.homes[0]
    if (!h) continue
    const km = haversineKm(h.lat, h.lon, pl.lat, pl.lon)
    if (km > farthest.km) farthest = { place: pl, km }
  }
  return {
    north: by((a, b) => b.lat - a.lat),
    south: by((a, b) => a.lat - b.lat),
    east: by((a, b) => b.lon - a.lon),
    west: by((a, b) => a.lon - b.lon),
    farthest,
  }
}

// ---------------------------------------------------------------------------
export function manufacturer(aircraft: string): string {
  const a = aircraft.toLowerCase()
  if (!a) return 'Unknown'
  if (a.startsWith('airbus')) return 'Airbus'
  if (a.startsWith('boeing')) return 'Boeing'
  if (a.startsWith('embraer')) return 'Embraer'
  if (a.startsWith('atr')) return 'ATR'
  if (a.includes('bombardier') || a.includes('crj') || a.includes('canadair')) return 'Bombardier'
  if (a.includes('dash') || a.includes('de havilland')) return 'De Havilland'
  return aircraft.split(' ')[0]
}

export const routeKey = (f: Flight) => [f.from, f.to].sort().join('–')

export function flightStats(flights: Flight[]) {
  const withDur = flights.filter((f) => f.durationMin != null)
  const withAir = flights.filter((f) => f.airMin != null && f.airMin > 10)
  const withArrDelay = flights.filter((f) => f.arrDelayMin != null)
  const withDepDelay = flights.filter((f) => f.depDelayMin != null)
  const byDist = [...flights].sort((a, b) => b.distanceKm - a.distanceKm)
  const byDur = [...withDur].sort((a, b) => b.durationMin! - a.durationMin!)
  const speed = (f: Flight) => f.distanceKm / (f.airMin! / 60)
  const tails = countBy(flights, (f) => f.tail || null).filter(([, n]) => n > 1)
  const km = sum(flights.map((f) => f.distanceKm))
  const minutes = sum(withDur.map((f) => f.durationMin!))
  const airports = countBy(
    flights.flatMap((f) => [f.from, f.to]),
    (x) => x,
  )
  const hours = Array.from({ length: 24 }, () => 0)
  for (const f of flights) if (f.depLocalHour != null) hours[f.depLocalHour]++
  const weekdays = Array.from({ length: 7 }, () => 0)
  for (const f of flights) weekdays[(new Date(`${f.date}T12:00:00Z`).getUTCDay() + 6) % 7]++

  return {
    count: flights.length,
    km,
    minutes,
    airports,
    airlines: countBy(flights, (f) => f.airlineName),
    aircraft: countBy(flights, (f) => f.aircraft || null),
    manufacturers: countBy(flights, (f) => manufacturer(f.aircraft)),
    routes: countBy(flights, routeKey),
    countries: new Set(flights.flatMap((f) => [f.fromCc, f.toCc])),
    longest: byDist[0],
    shortest: byDist[byDist.length - 1],
    longestTime: byDur[0],
    shortestTime: byDur[byDur.length - 1],
    fastest: [...withAir].sort((a, b) => speed(b) - speed(a))[0],
    speedOf: (f: Flight) => (f.airMin ? Math.round(speed(f)) : null),
    mostDelayed: [...withArrDelay].sort((a, b) => b.arrDelayMin! - a.arrDelayMin!)[0],
    earliestArrival: [...withArrDelay].sort((a, b) => a.arrDelayMin! - b.arrDelayMin!)[0],
    medianDepDelay: median(withDepDelay.map((f) => f.depDelayMin!)),
    avgArrDelay: withArrDelay.length
      ? sum(withArrDelay.map((f) => f.arrDelayMin!)) / withArrDelay.length
      : null,
    onTimePct: withArrDelay.length
      ? withArrDelay.filter((f) => f.arrDelayMin! <= 15).length / withArrDelay.length
      : null,
    delayedCount: withArrDelay.filter((f) => f.arrDelayMin! > 15).length,
    punctualityN: withArrDelay.length,
    longestTaxi: [...flights.filter((f) => f.taxiOutMin != null)].sort(
      (a, b) => b.taxiOutMin! - a.taxiOutMin!,
    )[0],
    medianTaxi: median(flights.filter((f) => f.taxiOutMin != null).map((f) => f.taxiOutMin!)),
    seatTypes: countBy(flights, (f) => f.seatType || null),
    cabins: countBy(flights, (f) => f.cabin || null),
    reasons: countBy(flights, (f) => f.reason || null),
    domestic: flights.filter((f) => f.fromCc === f.toCc).length,
    redEyes: flights.filter(
      (f) =>
        f.depLocalHour != null &&
        (f.depLocalHour >= 21 || f.depLocalHour <= 2) &&
        (f.durationMin ?? 0) >= 150,
    ).length,
    biggestTzShift: [...flights].sort((a, b) => Math.abs(b.tzShiftH) - Math.abs(a.tzShiftH))[0],
    tails,
    uniqueTails: new Set(flights.map((f) => f.tail).filter(Boolean)).size,
    byYear: countBy(flights, (f) => f.date.slice(0, 4)).sort((a, b) => a[0].localeCompare(b[0])),
    hours,
    weekdays,
    earliestDeparture: [...flights.filter((f) => f.depLocalHour != null)].sort((a, b) => {
      const ha = (a.depLocalHour! + 21) % 24 // treat 3am as the "start" of the day
      const hb = (b.depLocalHour! + 21) % 24
      return ha - hb
    })[0],
  }
}
export type FlightStats = ReturnType<typeof flightStats>

// ---------------------------------------------------------------------------
export const MODE_LABEL: Record<TravelMode, string> = {
  car: 'Car',
  walking: 'Walking',
  running: 'Running',
  cycling: 'Cycling',
  bus: 'Bus',
  subway: 'Subway',
  train: 'Train',
  tram: 'Tram',
  ferry: 'Ferry',
  flying: 'Flying',
  motorcycle: 'Motorcycle',
  boat: 'Boat',
  skiing: 'Skiing',
  unknown: 'Other',
}

/** Rough kg CO₂e per passenger-km (UK DESNZ 2024 factors, rounded). */
export const CO2_PER_KM: Partial<Record<TravelMode, number>> = {
  car: 0.17,
  motorcycle: 0.11,
  bus: 0.1,
  subway: 0.03,
  train: 0.035,
  tram: 0.03,
  ferry: 0.11,
  flying: 0.15,
}

export function movementStats(acts: Activity[], flights: Flight[]) {
  const modes = new Map<
    TravelMode,
    { km: number; hours: number; n: number; longest: Activity | null }
  >()
  for (const a of acts) {
    let s = modes.get(a.mode)
    if (!s) modes.set(a.mode, (s = { km: 0, hours: 0, n: 0, longest: null }))
    s.km += a.km
    s.hours += (a.e - a.s) / 3600000
    s.n++
    if (!s.longest || a.km > s.longest.km) s.longest = a
  }
  const list = [...modes.entries()].map(([mode, s]) => ({ mode, ...s })).sort((a, b) => b.km - a.km)
  const groundKm = sum(list.filter((m) => m.mode !== 'flying').map((m) => m.km))
  const flightKm = sum(flights.map((f) => f.distanceKm))
  let co2 = 0
  for (const m of list) if (m.mode !== 'flying') co2 += (CO2_PER_KM[m.mode] ?? 0) * m.km
  co2 += flightKm * (CO2_PER_KM.flying ?? 0)
  const byYear = new Map<string, Record<string, number>>()
  for (const a of acts) {
    const y = localDate(a.s, a.off).slice(0, 4)
    const r = byYear.get(y) ?? {}
    r[a.mode] = (r[a.mode] ?? 0) + a.km
    byYear.set(y, r)
  }
  const weekday = Array.from({ length: 7 }, () => 0)
  for (const a of acts) {
    if (a.mode === 'flying') continue
    weekday[(new Date(a.s + a.off * 60000).getUTCDay() + 6) % 7] += a.km
  }
  return { list, groundKm, flightKm, co2, byYear, weekday }
}

// ---------------------------------------------------------------------------
export function overview(
  fd: Filtered,
  tl: TimelineData | null,
  countries: Record<string, CountryInfo>,
  cStats: Map<string, CountryStat>,
) {
  const ccs = [...cStats.keys()].filter((c) => countries[c])
  const continents = new Set(ccs.map((c) => continentOf(countries[c])))
  const cities = new Set(fd.days.flatMap((d) => d.ci))
  const daysAway = fd.days.filter((d) => d.far >= 100).length
  const daysAbroad = tl
    ? fd.days.filter((d) => {
        const homeCc = tl.cities[d.home]?.cc
        return homeCc && d.cc.some((c) => c !== homeCc)
      }).length
    : 0
  const unCount = ccs.filter((c) => countries[c].unMember).length
  return {
    countries: ccs,
    continents,
    cities,
    daysAway,
    daysAbroad,
    daysTracked: fd.days.length,
    unCount,
  }
}

/** Countries first visited per year (cumulative world discovery curve). */
export function discoveryCurve(tl: TimelineData | null, flights: Flight[]) {
  const first = new Map<string, string>()
  const note = (cc: string, d: string) => {
    if (!cc) return
    const cur = first.get(cc)
    if (!cur || d < cur) first.set(cc, d)
  }
  if (tl) for (const d of tl.days) for (const cc of d.cc) note(cc, d.d)
  for (const f of flights) {
    note(f.fromCc, f.date)
    note(f.toCc, f.date)
  }
  return first
}
