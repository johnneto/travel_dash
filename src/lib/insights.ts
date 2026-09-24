import type { DateRange, Selection, TimelineData } from '../types'
import type { CrossData } from './cross'
import { airlineIata, type RefData } from './refdata'
import {
  median,
  type CityStat,
  type CountryStat,
  type Filtered,
  type FlightStats,
  type extremes,
  type movementStats,
  type overview,
} from './stats'
import { EARTH_CIRCUMFERENCE_KM, MOON_DISTANCE_KM } from './geo'
import { fmtDate, fmtDuration, fmtHours, fmtKm, fmtNum, fmtNum1, MONTHS, plural } from './format'

export type SeatKind = 'window' | 'middle' | 'aisle'

export type InsightKind =
  | 'globe'
  | 'plane'
  | 'clock'
  | 'map'
  | 'trophy'
  | 'walk'
  | 'calendar'
  | 'compass'
  | 'sparkles'
  | 'leaf'
  | 'search'
  | 'seat'

/** A picture shown beside the tile's value. */
export type InsightVisual =
  | { type: 'aircraft'; name: string }
  | { type: 'airline'; iata: string | null; code: string }
  | { type: 'seat'; seat: SeatKind }

export interface Insight {
  id: string
  kind: InsightKind
  label: string
  value: string
  text: string
  select?: Selection
  visual?: InsightVisual
}

export interface InsightInput {
  fd: Filtered
  cStats: Map<string, CountryStat>
  ov: ReturnType<typeof overview>
  fStats: FlightStats
  mStats: ReturnType<typeof movementStats>
  cities: CityStat[]
  ext: ReturnType<typeof extremes>
  cross: CrossData
  discovery: Map<string, string>
  tl: TimelineData | null
  ref: RefData
  homeCc: string | null
  range: DateRange
  country: string | null
}

const MARATHON_KM = 42.195

export function buildInsights(x: InsightInput): Insight[] {
  const out: Insight[] = []
  const { fd, fStats: fs, ref, tl } = x
  const cname = (cc: string) => ref.countries[cc]?.name ?? cc
  const cflag = (cc: string) => ref.countries[cc]?.flag ?? ''
  const cityName = (i: number) => (tl && i >= 0 ? tl.cities[i]?.name : undefined) ?? '—'
  const periodLabel =
    x.range.from || x.range.to
      ? x.range.from?.slice(0, 4) === x.range.to?.slice(0, 4) && x.range.from
        ? `in ${x.range.from.slice(0, 4)}`
        : 'in this period'
      : 'so far'

  // ---- Country spotlight ----
  if (x.country) {
    const s = x.cStats.get(x.country)
    const first = x.discovery.get(x.country)
    const topCity = x.cities.find((c) => tl?.cities[c.idx]?.cc === x.country)
    if (s) {
      out.push({
        id: 'country-spotlight',
        kind: 'map',
        label: `${cflag(x.country)} ${cname(x.country)}`,
        value: s.days ? plural(s.days, 'day') : plural(s.flightsIn, 'arrival'),
        text: [
          first ? `First visited on ${fmtDate(first)}.` : '',
          s.trips ? `${plural(s.trips, 'trip')} involved ${cname(x.country)}.` : '',
          topCity
            ? `Most time spent in ${cityName(topCity.idx)} (${plural(topCity.days, 'day')}).`
            : '',
          s.cities.size > 1 ? `${s.cities.size} cities/towns visited.` : '',
        ]
          .filter(Boolean)
          .join(' '),
        select: { type: 'country', cc: x.country },
      })
    }
  }

  // ---- Flights ----
  if (fs.count) {
    const laps = fs.km / EARTH_CIRCUMFERENCE_KM
    out.push({
      id: 'around-earth',
      kind: 'globe',
      label: 'Distance flown',
      value: fmtKm(fs.km),
      text:
        laps >= 1
          ? `That's ${fmtNum1(laps)}× around the Earth — and ${Math.round((fs.km / MOON_DISTANCE_KM) * 100)}% of the way to the Moon.`
          : `That's ${Math.round(laps * 100)}% of a lap around the Earth.`,
    })
    out.push({
      id: 'air-time',
      kind: 'clock',
      label: 'Time on planes',
      value: fmtDuration(fs.minutes),
      text: `${fmtNum1(fs.minutes / 60 / 24)} days of your life gate-to-gate across ${plural(fs.count, 'flight')}.`,
    })
    if (fs.aircraft[0]) {
      out.push({
        id: 'top-aircraft',
        kind: 'plane',
        label: 'Most flown aircraft',
        value: fs.aircraft[0][0],
        text: `${plural(fs.aircraft[0][1], 'flight')} (${Math.round((fs.aircraft[0][1] / fs.count) * 100)}%). ${
          fs.manufacturers[0]
            ? `${plural(fs.manufacturers[0][1], 'flight')} were on ${fs.manufacturers[0][0]} jets.`
            : ''
        }`,
        visual: { type: 'aircraft', name: fs.aircraft[0][0] },
      })
    }
    if (fs.airlines[0]) {
      const [name, n] = fs.airlines[0]
      const code = fd.flights.find((q) => q.airlineName === name)?.airline ?? ''
      out.push({
        id: 'top-airline',
        kind: 'plane',
        label: 'Most flown airline',
        value: name,
        text: `${plural(n, 'flight')} (${Math.round((n / fs.count) * 100)}%)${
          fs.airlines.length > 1 ? `, out of ${fs.airlines.length} airlines flown` : ''
        } ${periodLabel}.`,
        visual: { type: 'airline', iata: airlineIata(code, ref.airlines), code },
      })
    }
    if (fs.routes[0] && fs.routes[0][1] > 1) {
      const [a, b] = fs.routes[0][0].split('–')
      out.push({
        id: 'top-route',
        kind: 'trophy',
        label: 'Favourite route',
        value: `${a} ⇄ ${b}`,
        text: `Flown ${plural(fs.routes[0][1], 'time')} ${periodLabel} — ${ref.airports[a]?.city} to ${ref.airports[b]?.city}.`,
        select: { type: 'route', from: a, to: b },
      })
    }
    if (fs.longest) {
      const f = fs.longest
      out.push({
        id: 'longest-flight',
        kind: 'plane',
        label: 'Longest flight',
        value: `${f.from} → ${f.to}`,
        text: `${fmtKm(f.distanceKm)} in ${fmtDuration(f.durationMin)} on ${f.airlineName} (${f.aircraft || 'unknown aircraft'}), ${fmtDate(f.date)}.`,
        select: { type: 'flight', id: f.id },
        visual: f.aircraft ? { type: 'aircraft', name: f.aircraft } : undefined,
      })
    }
    if (fs.shortest && fs.count > 1) {
      const f = fs.shortest
      out.push({
        id: 'shortest-flight',
        kind: 'plane',
        label: 'Shortest hop',
        value: `${f.from} → ${f.to}`,
        text: `Just ${fmtKm(f.distanceKm)}${f.airMin ? ` and ${fmtDuration(f.airMin)} in the air` : ''} on ${fmtDate(f.date)}.`,
        select: { type: 'flight', id: f.id },
        visual: f.aircraft ? { type: 'aircraft', name: f.aircraft } : undefined,
      })
    }
    if (fs.tails[0]) {
      const [tail, n] = fs.tails[0]
      const f = fd.flights.find((q) => q.tail === tail)!
      out.push({
        id: 'same-plane',
        kind: 'sparkles',
        label: 'Déjà vu',
        value: tail,
        text: `You boarded this exact ${f.aircraft || 'aircraft'} ${plural(n, 'time')}${
          fs.tails.length > 1
            ? ` — and ${plural(fs.tails.length - 1, 'other plane')} more than once`
            : ''
        }.`,
        visual: f.aircraft ? { type: 'aircraft', name: f.aircraft } : undefined,
      })
    }
    if (fs.onTimePct != null && fs.punctualityN >= 5) {
      out.push({
        id: 'punctuality',
        kind: 'clock',
        label: 'Punctuality',
        value: `${Math.round(fs.onTimePct * 100)}% on time`,
        text: `Arrived within 15 min of schedule on ${fmtNum(fs.punctualityN - fs.delayedCount)} of ${fmtNum(fs.punctualityN)} flights.${
          fs.mostDelayed && fs.mostDelayed.arrDelayMin! > 30
            ? ` Worst: ${fs.mostDelayed.flightNo} landed ${fmtDuration(fs.mostDelayed.arrDelayMin)} late.`
            : ''
        }`,
        select: fs.mostDelayed ? { type: 'flight', id: fs.mostDelayed.id } : undefined,
      })
    }
    const seats = fs.seatTypes
    if (seats.length) {
      const total = seats.reduce((a, b) => a + b[1], 0)
      out.push({
        id: 'seat',
        kind: 'seat',
        label: 'Seat preference',
        value: `${seats[0][0][0].toUpperCase()}${seats[0][0].slice(1)} person`,
        text: `${seats.map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`).join(' · ')} (of ${plural(total, 'flight')} with a seat recorded).`,
        visual:
          seats[0][0] === 'window' || seats[0][0] === 'middle' || seats[0][0] === 'aisle'
            ? { type: 'seat', seat: seats[0][0] as SeatKind }
            : undefined,
      })
    }
    if (fs.biggestTzShift && Math.abs(fs.biggestTzShift.tzShiftH) >= 3) {
      const f = fs.biggestTzShift
      out.push({
        id: 'jetlag',
        kind: 'clock',
        label: 'Biggest jet lag',
        value: `${f.tzShiftH > 0 ? '+' : ''}${f.tzShiftH}h`,
        text: `${f.from} → ${f.to} on ${fmtDate(f.date)} moved your clock ${Math.abs(f.tzShiftH)} hours.`,
        select: { type: 'flight', id: f.id },
      })
    }
  }

  // ---- Cross: timeline ⇄ flights ----
  const matched = fd.flights.map((f) => x.cross.matches.get(f.id)).filter(Boolean)
  const leads = matched.map((m) => m!.leadMin).filter((v): v is number => v != null)
  const exits = matched.map((m) => m!.exitMin).filter((v): v is number => v != null)
  if (leads.length >= 3) {
    out.push({
      id: 'airport-habit',
      kind: 'clock',
      label: 'Airport habits',
      value: `${fmtDuration(median(leads))} early`,
      text: `Your timeline shows you typically reach the airport ${fmtDuration(median(leads))} before departure${
        exits.length >= 3
          ? ` and leave the arrival airport ${fmtDuration(median(exits))} after reaching the gate`
          : ''
      }.`,
    })
  }
  if (tl && x.cross.unlogged.length) {
    const inRange = x.cross.unlogged.filter((u) => {
      const d = new Date(u.s).toISOString().slice(0, 10)
      return (!x.range.from || d >= x.range.from) && (!x.range.to || d <= x.range.to)
    })
    const examples = inRange
      .slice(0, 2)
      .map((u) => `${u.from?.iata ?? '?'}→${u.to?.iata ?? '?'} on ${fmtDate(u.s)}`)
      .join(', ')
    // Without a Flighty log every Google flight is "unlogged", so frame it as detection instead.
    const hasFlighty = x.cross.matches.size > 0
    if (inRange.length)
      out.push({
        id: 'unlogged',
        kind: 'search',
        label: hasFlighty ? 'Missing from Flighty?' : 'Flights spotted by Google',
        value: plural(inRange.length, 'flight'),
        text: hasFlighty
          ? `Google recorded flights with no match in Flighty, e.g. ${examples}.`
          : `Google Timeline recorded flights such as ${examples}. Import Flighty for delays, aircraft and more.`,
      })
  }

  // ---- Places & trips ----
  if (tl && fd.days.length) {
    const abroad = [...x.cStats.values()]
      .filter((c) => c.cc !== x.homeCc && c.days > 0)
      .sort((a, b) => b.days - a.days)
    if (abroad[0] && !x.country) {
      out.push({
        id: 'fav-country',
        kind: 'map',
        label: 'Favourite country abroad',
        value: `${cflag(abroad[0].cc)} ${cname(abroad[0].cc)}`,
        text: `${plural(abroad[0].days, 'day')} ${periodLabel}, across ${plural(abroad[0].trips || 1, 'trip')}.`,
        select: { type: 'country', cc: abroad[0].cc },
      })
    }
    const newCountries = [...x.discovery.entries()]
      .filter(([, d]) => (!x.range.from || d >= x.range.from) && (!x.range.to || d <= x.range.to))
      .sort((a, b) => a[1].localeCompare(b[1]))
    if ((x.range.from || x.range.to) && newCountries.length) {
      out.push({
        id: 'new-countries',
        kind: 'sparkles',
        label: 'New countries',
        value: newCountries.map(([c]) => cflag(c)).join(' '),
        text: `First-ever visits: ${newCountries.map(([c, d]) => `${cname(c)} (${fmtDate(d, 'month')})`).join(', ')}.`,
      })
    }
    out.push({
      id: 'continents',
      kind: 'globe',
      label: 'World coverage',
      value: `${x.ov.countries.length} countries`,
      text: `${plural(x.ov.continents.size, 'continent')} and ${Math.round((x.ov.unCount / 193) * 100)}% of UN member states ${periodLabel}.`,
    })
    const longestTrip = [...fd.trips].sort((a, b) => b.days - a.days)[0]
    if (longestTrip) {
      out.push({
        id: 'longest-trip',
        kind: 'calendar',
        label: 'Longest trip',
        value: plural(longestTrip.days, 'day'),
        text: `${fmtDate(longestTrip.start)} – ${fmtDate(longestTrip.end)}: ${longestTrip.countries.map(cflag).join(' ')} mostly around ${cityName(longestTrip.mainCity)}.`,
        select: { type: 'trip', id: longestTrip.id },
      })
    }
    const mostCountries = [...fd.trips].sort((a, b) => b.countries.length - a.countries.length)[0]
    if (mostCountries && mostCountries.countries.length >= 3 && mostCountries !== longestTrip) {
      out.push({
        id: 'multi-country',
        kind: 'trophy',
        label: 'Most countries in one trip',
        value: `${mostCountries.countries.length} countries`,
        text: `${mostCountries.countries.map((c) => `${cflag(c)} ${cname(c)}`).join(', ')} in ${plural(mostCountries.days, 'day')} (${fmtDate(mostCountries.start, 'month')}).`,
        select: { type: 'trip', id: mostCountries.id },
      })
    }
    // Busiest month away from home
    const byMonth = new Map<string, number>()
    for (const d of fd.days)
      if (d.far >= 100) byMonth.set(d.d.slice(0, 7), (byMonth.get(d.d.slice(0, 7)) ?? 0) + 1)
    const busiest = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]
    if (busiest) {
      const seasonal = new Array(12).fill(0) as number[]
      for (const [m, n] of byMonth) seasonal[Number(m.slice(5)) - 1] += n
      const topMonth = seasonal.indexOf(Math.max(...seasonal))
      out.push({
        id: 'busiest-month',
        kind: 'calendar',
        label: 'Busiest travel month',
        value: fmtDate(`${busiest[0]}-01`, 'month'),
        text: `${plural(busiest[1], 'day')} away from home. Across all years, ${MONTHS[topMonth]} is when you travel most.`,
      })
    }
    if (x.ext?.farthest && x.ext.farthest.km > 200) {
      const p = x.ext.farthest.place
      out.push({
        id: 'farthest',
        kind: 'compass',
        label: 'Farthest from home',
        value: fmtKm(x.ext.farthest.km),
        text: `${cityName(p.city)}, ${cname(p.cc)} — the furthest you've been from where you lived at the time.`,
        select: { type: 'point', lat: p.lat, lon: p.lon, label: cityName(p.city) },
      })
    }
    if (x.ext) {
      const n = x.ext.north
      const s = x.ext.south
      out.push({
        id: 'extremes',
        kind: 'compass',
        label: 'North ↔ South',
        value: `${Math.round(n.lat - s.lat)}° of latitude`,
        text: `From ${cityName(n.city)} (${n.lat.toFixed(1)}°) to ${cityName(s.city)} (${s.lat.toFixed(1)}°).`,
        select: { type: 'point', lat: n.lat, lon: n.lon, label: cityName(n.city) },
      })
    }
  }

  // ---- Movement ----
  const walk = x.mStats.list.find((m) => m.mode === 'walking')
  if (walk && walk.km > 5) {
    out.push({
      id: 'walking',
      kind: 'walk',
      label: 'On foot',
      value: fmtKm(walk.km),
      text: `Equivalent to ${fmtNum(walk.km / MARATHON_KM)} marathons — ${fmtHours(walk.hours)} of walking ${periodLabel}.`,
    })
  }
  if (x.mStats.co2 > 10) {
    out.push({
      id: 'co2',
      kind: 'leaf',
      label: 'Travel footprint (est.)',
      value: `${fmtNum1(x.mStats.co2 / 1000)} t CO₂e`,
      text: `Flights account for ${Math.round(((x.mStats.flightKm * 0.15) / x.mStats.co2) * 100)}%. Rough estimate from average emission factors per km.`,
    })
  }
  const PRIORITY = [
    'country-spotlight',
    'new-countries',
    'continents',
    'around-earth',
    'fav-country',
    'longest-trip',
    'top-route',
    'longest-flight',
    'top-aircraft',
    'top-airline',
    'farthest',
    'airport-habit',
    'multi-country',
    'busiest-month',
    'punctuality',
    'unlogged',
    'walking',
    'same-plane',
    'air-time',
    'shortest-flight',
    'jetlag',
    'seat',
    'extremes',
    'co2',
  ]
  const rank = (id: string) => PRIORITY.indexOf(id) + 1 || 99
  return out.sort((a, b) => rank(a.id) - rank(b.id))
}
