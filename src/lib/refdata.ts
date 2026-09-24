import type { Airport, CountryInfo } from '../types'

/** Resolve a file in public/data regardless of the deploy base path (works in workers too). */
export function dataUrl(file: string): string {
  const base = (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/')
  const origin = typeof self !== 'undefined' && 'location' in self ? self.location.origin : ''
  return `${origin}${base}data/${file}`
}

type RawCountries = Record<
  string,
  {
    n: string
    f: string
    r: string
    s: string
    c: [number, number]
    a: number
    u: 0 | 1
    i: string
  }
>
type RawAirports = Record<string, [string, string, string, number, number, string, string]>
type RawAirlines = Record<string, [string, string, string]>

export interface RefData {
  countries: Record<string, CountryInfo>
  airports: Record<string, Airport>
  airlines: Record<string, { name: string; iata: string; country: string }>
}

export function buildCountries(raw: RawCountries): Record<string, CountryInfo> {
  const out: Record<string, CountryInfo> = {}
  for (const [code, c] of Object.entries(raw)) {
    out[code] = {
      code,
      name: c.n,
      flag: c.f,
      region: c.r,
      subregion: c.s,
      lat: c.c[0],
      lon: c.c[1],
      area: c.a,
      unMember: c.u === 1,
      ccn3: c.i,
    }
  }
  return out
}

export function buildAirports(raw: RawAirports): Record<string, Airport> {
  const out: Record<string, Airport> = {}
  for (const [iata, a] of Object.entries(raw)) {
    out[iata] = { iata, name: a[0], city: a[1], cc: a[2], lat: a[3], lon: a[4], tz: a[5] }
  }
  return out
}

export function buildAirlines(raw: RawAirlines): RefData['airlines'] {
  const out: RefData['airlines'] = {}
  for (const [icao, a] of Object.entries(raw)) out[icao] = { name: a[0], iata: a[1], country: a[2] }
  return out
}

let refPromise: Promise<RefData> | null = null

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(dataUrl(file))
  if (!res.ok) throw new Error(`Failed to load ${file} (${res.status})`)
  return res.json() as Promise<T>
}

export function loadRefData(): Promise<RefData> {
  refPromise ??= Promise.all([
    getJson<RawCountries>('countries.json'),
    getJson<RawAirports>('airports.json'),
    getJson<RawAirlines>('airlines.json'),
  ]).then(([c, ap, al]) => ({
    countries: buildCountries(c),
    airports: buildAirports(ap),
    airlines: buildAirlines(al),
  }))
  return refPromise
}

export { getJson }

/** Continent grouping used for "continents visited" (7-continent model). */
export function continentOf(c: CountryInfo | undefined): string {
  if (!c) return 'Unknown'
  if (c.region === 'Americas') {
    return c.subregion === 'South America' ? 'South America' : 'North America'
  }
  if (c.region === 'Antarctic') return 'Antarctica'
  return c.region // Africa, Asia, Europe, Oceania
}

export const CONTINENTS = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const

/** IATA code for a Flighty airline code (ICAO), for looking up logos. */
export function airlineIata(code: string, airlines: RefData['airlines']): string | null {
  return airlines[code]?.iata || (code.length === 2 ? code : null)
}
