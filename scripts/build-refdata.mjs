#!/usr/bin/env node
/**
 * Builds the compact, public reference datasets the app uses for offline
 * reverse-geocoding and flight enrichment. Output goes to public/data/.
 *
 * Sources (all openly licensed):
 *  - Cities: GeoNames via the `all-the-cities` npm package (CC BY 4.0)
 *  - States / regions: GeoNames admin1CodesASCII.txt (CC BY 4.0)
 *  - Countries: `world-countries` (ODbL) + `world-atlas` Natural Earth TopoJSON (public domain)
 *  - Airports: github.com/mwgg/Airports (MIT)
 *  - Airlines: OpenFlights airlines.dat (ODbL)
 *
 * Usage: npm run refdata
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, existsSync, readFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'data')
const cache = join(root, 'scripts', '.cache')
mkdirSync(out, { recursive: true })
mkdirSync(cache, { recursive: true })

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d

async function cached(name, url) {
  const p = join(cache, name)
  if (!existsSync(p)) {
    console.log(`Downloading ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    writeFileSync(p, Buffer.from(await res.arrayBuffer()))
  }
  return readFileSync(p, 'utf8')
}

// ---------- Countries ----------
const countries = require('world-countries')
const countryOut = {}
for (const c of countries) {
  countryOut[c.cca2] = {
    n: c.name.common,
    f: c.flag,
    r: c.region,
    s: c.subregion,
    c: c.latlng.map((x) => round(x, 2)),
    a: c.area,
    u: c.unMember ? 1 : 0,
    i: c.ccn3,
  }
}
writeFileSync(join(out, 'countries.json'), JSON.stringify(countryOut))
copyFileSync(require.resolve('world-atlas/countries-110m.json'), join(out, 'countries-110m.json'))
copyFileSync(require.resolve('world-atlas/countries-50m.json'), join(out, 'countries-50m.json'))
console.log(`countries: ${Object.keys(countryOut).length}`)

// ---------- Cities (population >= 5000, plus all capitals/seats) ----------
const cities = require('all-the-cities')
const cityOut = cities
  .filter((c) => !['PPLX', 'PPLH', 'PPLQ', 'PPLW'].includes(c.featureCode))
  .filter((c) => c.population >= 5000 || c.featureCode === 'PPLC' || c.featureCode === 'PPLA')
  .map((c) => [
    c.name,
    c.country,
    round(c.loc.coordinates[1], 3),
    round(c.loc.coordinates[0], 3),
    c.population,
    c.adminCode ?? '',
  ])
writeFileSync(join(out, 'cities.json'), JSON.stringify(cityOut))
console.log(`cities: ${cityOut.length}`)

// ---------- States / regions (GeoNames admin1), keyed "CC.code" ----------
const admin1Txt = await cached(
  'admin1CodesASCII.txt',
  'https://download.geonames.org/export/dump/admin1CodesASCII.txt',
)
const usedAdmin = new Set(cityOut.map((c) => `${c[1]}.${c[5]}`))
const admin1Out = {}
for (const line of admin1Txt.split('\n')) {
  const [key, name] = line.split('\t')
  if (key && name && usedAdmin.has(key)) admin1Out[key] = name
}
writeFileSync(join(out, 'admin1.json'), JSON.stringify(admin1Out))
console.log(`admin1: ${Object.keys(admin1Out).length}`)

// ---------- Airports ----------
const airports = JSON.parse(
  await cached('airports.json', 'https://raw.githubusercontent.com/mwgg/Airports/master/airports.json'),
)
const apOut = {}
for (const a of Object.values(airports)) {
  if (!a.iata || a.iata.length !== 3) continue
  apOut[a.iata] = [a.name, a.city, a.country, round(a.lat), round(a.lon), a.tz, a.icao]
}
writeFileSync(join(out, 'airports.json'), JSON.stringify(apOut))
console.log(`airports: ${Object.keys(apOut).length}`)

// ---------- Airlines (keyed by ICAO, Flighty exports ICAO codes) ----------
const airlinesDat = await cached(
  'airlines.dat',
  'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat',
)
const parseCsvLine = (line) =>
  [...line.matchAll(/("([^"]*)"|\\N|[^,]*)(,|$)/g)].map((m) => (m[2] ?? m[1]).replace(/^\\N$/, ''))
const alOut = {}
for (const line of airlinesDat.split('\n')) {
  if (!line.trim()) continue
  const [, name, , iata, icao, , country, active] = parseCsvLine(line)
  if (!icao || icao.length !== 3) continue
  // Prefer active carriers when an ICAO code was reused.
  if (alOut[icao] && active !== 'Y') continue
  alOut[icao] = [name, iata, country]
}
// Rebrands / codes missing or outdated in OpenFlights.
Object.assign(alOut, {
  LAN: ['LATAM Airlines', 'LA', 'Chile'],
  TAM: ['LATAM Brasil', 'JJ', 'Brazil'],
  LPE: ['LATAM Perú', 'LP', 'Peru'],
  AZU: ['Azul', 'AD', 'Brazil'],
  TKJ: ['AJet', 'VF', 'Turkey'],
  WMT: ['Wizz Air Malta', 'W4', 'Malta'],
  WUK: ['Wizz Air UK', 'W9', 'United Kingdom'],
  WAZ: ['Wizz Air Abu Dhabi', '5W', 'United Arab Emirates'],
  VOE: ['Volotea', 'V7', 'Spain'],
  EWG: ['Eurowings', 'EW', 'Germany'],
  FDB: ['flydubai', 'FZ', 'United Arab Emirates'],
  ABY: ['Air Arabia', 'G9', 'United Arab Emirates'],
  ETD: ['Etihad Airways', 'EY', 'United Arab Emirates'],
  UAE: ['Emirates', 'EK', 'United Arab Emirates'],
  MSC: ['Air Cairo', 'SM', 'Egypt'],
  TVF: ['Transavia France', 'TO', 'France'],
  AEA: ['Air Europa', 'UX', 'Spain'],
  RYR: ['Ryanair', 'FR', 'Ireland'],
  GLO: ['GOL', 'G3', 'Brazil'],
})
writeFileSync(join(out, 'airlines.json'), JSON.stringify(alOut))
console.log(`airlines: ${Object.keys(alOut).length}`)
