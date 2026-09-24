import type { Activity, City, Day, HomePeriod, Place, TimelineData, Trip, Visit } from '../../types'
import type { RawTimeline } from '../parsers/timeline'
import type { ReverseGeocoder } from '../geocoder'
import { haversineKm } from '../geo'

/** Distance from home (km) above which a day counts as "away". */
export const AWAY_KM = 100
const MAX_GAP_DAYS = 2

export const localDate = (ms: number, offMin: number) =>
  new Date(ms + offMin * 60000).toISOString().slice(0, 10)

const HOME_SEMANTICS = new Set(['Home', 'Inferred Home'])

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}

interface DayAcc {
  cc: Set<string>
  ci: Set<number>
  pts: Map<string, [number, number]>
}

export type ProgressFn = (stage: string, pct: number) => void

export function processTimeline(
  raw: RawTimeline,
  geo: ReverseGeocoder,
  progress: ProgressFn = () => {},
): TimelineData {
  // ---- 1. UTC offsets: fill gaps with the last known offset ----
  const offsets: { t: number; off: number }[] = []
  for (const x of [...raw.visits, ...raw.activities])
    if (x.off != null) offsets.push({ t: x.s, off: x.off })
  offsets.sort((a, b) => a.t - b.t)
  const offsetAt = (t: number, lon: number): number => {
    let lo = 0
    let hi = offsets.length - 1
    let ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid].t <= t) {
        ans = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    if (ans >= 0 && t - offsets[ans].t < 3 * 86400000) return offsets[ans].off
    return Math.round(lon / 15) * 60
  }

  // ---- 2. Places & cities ----
  progress('Geocoding places', 0.1)
  const cityMap = new Map<number, number>() // global geocoder idx -> local idx
  const cities: City[] = []
  const localCity = (gIdx: number) => {
    if (gIdx < 0) return -1
    let l = cityMap.get(gIdx)
    if (l === undefined) {
      l = cities.length
      cities.push(geo.toCity(gIdx))
      cityMap.set(gIdx, l)
    }
    return l
  }
  const placeIdx = new Map<string, number>()
  const places: Place[] = []
  const visits: Visit[] = []
  for (const v of raw.visits) {
    let p = placeIdx.get(v.placeId)
    if (p === undefined) {
      p = places.length
      const cc = geo.country(v.lat, v.lon)
      const city = localCity(geo.city(v.lat, v.lon))
      places.push({ id: v.placeId, lat: v.lat, lon: v.lon, city, cc, sem: v.sem })
      placeIdx.set(v.placeId, p)
    } else if (places[p].sem === 'Unknown' && v.sem !== 'Unknown') {
      places[p].sem = v.sem
    }
    visits.push({ s: v.s, e: v.e, off: v.off ?? offsetAt(v.s, v.lon), p, sem: v.sem })
  }

  progress('Processing activities', 0.35)
  const activities: Activity[] = raw.activities.map((a) => ({
    s: a.s,
    e: a.e,
    off: a.off ?? offsetAt(a.s, a.a[1]),
    // Google sometimes labels long multi-leg segments (incl. flights) as driving: a single
    // ground segment spanning > 1,200 km in a straight line is treated as a flight.
    mode:
      a.mode !== 'flying' && haversineKm(a.a[0], a.a[1], a.b[0], a.b[1]) > 1200 ? 'flying' : a.mode,
    km: Math.round(a.km * 100) / 100,
    a: a.a,
    b: a.b,
    ccA: geo.country(a.a[0], a.a[1]),
    ccB: geo.country(a.b[0], a.b[1]),
  }))

  // ---- 3. Days ----
  progress('Building daily presence', 0.5)
  const days = new Map<string, DayAcc>()
  const day = (d: string) => {
    let acc = days.get(d)
    if (!acc) {
      acc = { cc: new Set(), ci: new Set(), pts: new Map() }
      days.set(d, acc)
    }
    return acc
  }
  const addPt = (acc: DayAcc, lat: number, lon: number) => {
    const k = `${lat.toFixed(1)},${lon.toFixed(1)}`
    if (!acc.pts.has(k)) acc.pts.set(k, [lat, lon])
  }
  for (const v of visits) {
    const pl = places[v.p]
    const d0 = localDate(v.s, v.off)
    const d1 = localDate(v.e, v.off)
    const span = Math.min(daysBetween(d0, d1), 120)
    for (let i = 0; i <= span; i++) {
      const acc = day(addDays(d0, i))
      if (pl.cc) acc.cc.add(pl.cc)
      if (pl.city >= 0) acc.ci.add(pl.city)
      addPt(acc, pl.lat, pl.lon)
    }
  }
  for (const a of activities) {
    if (a.mode === 'flying') continue // endpoints are airports, covered by visits/points
    const acc = day(localDate(a.s, a.off))
    if (a.ccA) acc.cc.add(a.ccA)
    if (a.ccB) acc.cc.add(a.ccB)
    addPt(acc, a.a[0], a.a[1])
    addPt(acc, a.b[0], a.b[1])
  }
  progress('Processing location path', 0.6)
  // Skip path points recorded mid-flight so overflown countries don't count as visited.
  const flights = activities.filter((a) => a.mode === 'flying').sort((a, b) => a.s - b.s)
  let fi = 0
  let prevPt: (typeof raw.points)[number] | null = null
  for (const p of raw.points) {
    while (fi < flights.length && flights[fi].e < p.t) fi++
    if (fi < flights.length && flights[fi].s <= p.t) continue
    // ...and points moving at airliner speed (> 250 km/h) that Google didn't label as flying.
    if (prevPt && p.t - prevPt.t < 3 * 3600000 && p.t > prevPt.t) {
      const kmh = haversineKm(prevPt.lat, prevPt.lon, p.lat, p.lon) / ((p.t - prevPt.t) / 3600000)
      prevPt = p
      if (kmh > 250) continue
    }
    prevPt = p
    const acc = day(localDate(p.t, offsetAt(p.t, p.lon)))
    const k = `${p.lat.toFixed(1)},${p.lon.toFixed(1)}`
    if (acc.pts.has(k)) continue
    acc.pts.set(k, [p.lat, p.lon])
    const cc = geo.country(p.lat, p.lon)
    if (cc) acc.cc.add(cc)
  }

  // ---- 4. Home detection (per month) ----
  progress('Detecting home', 0.75)
  const homeByMonth = new Map<string, Map<number, number>>()
  const hasHomeLabels = visits.some((v) => HOME_SEMANTICS.has(places[v.p].sem))
  for (const v of visits) {
    const pl = places[v.p]
    let weight = 0
    if (hasHomeLabels) {
      if (HOME_SEMANTICS.has(v.sem) || HOME_SEMANTICS.has(pl.sem)) weight = v.e - v.s
    } else {
      // No labels: count time spent overnight (local 0–6h).
      const h = new Date(v.s + v.off * 60000).getUTCHours()
      if (h < 6 || v.e - v.s > 6 * 3600000) weight = v.e - v.s
    }
    if (weight <= 0) continue
    const m = localDate(v.s, v.off).slice(0, 7)
    let mm = homeByMonth.get(m)
    if (!mm) homeByMonth.set(m, (mm = new Map()))
    mm.set(v.p, (mm.get(v.p) ?? 0) + weight)
  }
  const allMonths = [...new Set([...days.keys()].map((d) => d.slice(0, 7)))].sort()
  const monthHome = new Map<string, number>() // month -> place idx
  let prev = -1
  for (const m of allMonths) {
    const mm = homeByMonth.get(m)
    if (mm && mm.size) {
      prev = [...mm.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }
    if (prev >= 0) monthHome.set(m, prev)
  }
  // Back-fill months before the first known home.
  const firstHome = allMonths.map((m) => monthHome.get(m)).find((x) => x !== undefined)
  if (firstHome !== undefined)
    for (const m of allMonths)
      if (!monthHome.has(m)) monthHome.set(m, firstHome)
      else break

  const homes: HomePeriod[] = []
  for (const m of allMonths) {
    const p = monthHome.get(m)
    if (p === undefined) continue
    const pl = places[p]
    const lastH = homes[homes.length - 1]
    if (
      lastH &&
      (lastH.city === pl.city || haversineKm(lastH.lat, lastH.lon, pl.lat, pl.lon) < 30)
    ) {
      lastH.to = m
    } else {
      homes.push({ from: m, to: m, city: pl.city, lat: pl.lat, lon: pl.lon })
    }
  }
  const homeFor = (d: string): HomePeriod | undefined => {
    const m = d.slice(0, 7)
    for (const h of homes) if (m >= h.from && m <= h.to) return h
    return homes[0]
  }

  // ---- 5. Finalise days ----
  const dayList: Day[] = [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, acc]) => {
      const h = homeFor(d)
      let far = 0
      if (h)
        for (const [lat, lon] of acc.pts.values())
          far = Math.max(far, haversineKm(h.lat, h.lon, lat, lon))
      return { d, cc: [...acc.cc], ci: [...acc.ci], far: Math.round(far), home: h?.city ?? -1 }
    })

  // ---- 6. Trips ----
  progress('Detecting trips', 0.9)
  const trips: Trip[] = []
  let cur: Day[] = []
  const flush = () => {
    if (!cur.length) return
    const maxKm = Math.max(...cur.map((x) => x.far))
    if (maxKm >= AWAY_KM) {
      const home = cur[0].home
      const cityCount = new Map<number, number>()
      const orderedCities: number[] = []
      const orderedCountries: string[] = []
      for (const dd of cur) {
        for (const c of dd.ci) {
          if (c === home) continue
          if (!cityCount.has(c)) orderedCities.push(c)
          cityCount.set(c, (cityCount.get(c) ?? 0) + 1)
        }
        for (const cc of dd.cc) if (!orderedCountries.includes(cc)) orderedCountries.push(cc)
      }
      const h = homeFor(cur[0].d)
      const mainCity =
        [...cityCount.entries()].sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1]
          const ca = cities[a[0]]
          const cb = cities[b[0]]
          return h
            ? haversineKm(h.lat, h.lon, cb.lat, cb.lon) - haversineKm(h.lat, h.lon, ca.lat, ca.lon)
            : 0
        })[0]?.[0] ?? -1
      trips.push({
        id: trips.length,
        start: cur[0].d,
        end: cur[cur.length - 1].d,
        days: daysBetween(cur[0].d, cur[cur.length - 1].d) + 1,
        countries: orderedCountries,
        cities: orderedCities,
        maxKm,
        mainCity,
        home,
      })
    }
    cur = []
  }
  for (const dd of dayList) {
    const away = dd.far >= AWAY_KM
    if (!away) {
      flush()
      continue
    }
    const lastDay = cur[cur.length - 1]
    if (lastDay && daysBetween(lastDay.d, dd.d) > MAX_GAP_DAYS + 1) flush()
    cur.push(dd)
  }
  flush()

  let start = Infinity
  let end = 0
  for (const x of [...visits, ...activities]) {
    if (x.s < start) start = x.s
    if (x.e > end) end = x.e
  }
  progress('Done', 1)
  return {
    cities,
    places,
    visits,
    activities,
    days: dayList,
    homes,
    trips,
    memories: raw.memories,
    range: { start: Number.isFinite(start) ? start : 0, end },
    stats: { entries: raw.entries, pathPoints: raw.points.length, format: raw.format },
  }
}
