/// <reference lib="webworker" />
import type { Topology } from 'topojson-specification'
import { ReverseGeocoder, type RawCity } from '../lib/geocoder'
import { enrichFlights, ImportError, parseFlightyCsv } from '../lib/parsers/flighty'
import { parseTimeline } from '../lib/parsers/timeline'
import { processTimeline } from '../lib/process/timeline'
import { buildAirlines, buildAirports, getJson } from '../lib/refdata'
import type { Flight, TimelineData } from '../types'

export type WorkerRequest = { id: number; file: File }
export type WorkerResponse =
  | { id: number; type: 'progress'; stage: string; pct: number }
  | { id: number; type: 'flights'; flights: Flight[]; unknownAirports: string[]; name: string }
  | { id: number; type: 'timeline'; timeline: TimelineData; name: string }
  | { id: number; type: 'error'; message: string }

const post = (m: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m)

let geocoder: Promise<ReverseGeocoder> | null = null
function getGeocoder() {
  geocoder ??= Promise.all([
    getJson<RawCity[]>('cities.json'),
    getJson<Topology>('countries-50m.json'),
    getJson<Record<string, { i: string }>>('countries.json'),
  ]).then(([cities, topo, countries]) => {
    const ccn: Record<string, string> = {}
    for (const [cc, c] of Object.entries(countries)) ccn[c.i] = cc
    return new ReverseGeocoder(cities, topo, ccn)
  })
  return geocoder
}

function sniff(name: string, head: string): 'flights' | 'timeline' | null {
  const t = head.trimStart()
  if (t.startsWith('[') || t.startsWith('{')) return 'timeline'
  if (/^﻿?"?Date"?,/.test(t) || name.toLowerCase().endsWith('.csv')) return 'flights'
  return null
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const { id, file } = ev.data
  const progress = (stage: string, pct: number) => post({ id, type: 'progress', stage, pct })
  try {
    progress('Reading file', 0.02)
    const text = await file.text()
    const kind = sniff(file.name, text.slice(0, 200))
    if (kind === 'flights') {
      progress('Parsing flights', 0.3)
      const rows = parseFlightyCsv(text)
      const [ap, al] = await Promise.all([
        getJson<Parameters<typeof buildAirports>[0]>('airports.json'),
        getJson<Parameters<typeof buildAirlines>[0]>('airlines.json'),
      ])
      const { flights, unknownAirports } = enrichFlights(rows, buildAirports(ap), buildAirlines(al))
      if (!flights.length) throw new ImportError('No flights found in this file.')
      post({ id, type: 'flights', flights, unknownAirports, name: file.name })
    } else if (kind === 'timeline') {
      progress('Parsing JSON', 0.05)
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new ImportError('The file is not valid JSON.')
      }
      const raw = parseTimeline(json)
      if (!raw.visits.length && !raw.activities.length) {
        throw new ImportError('No visits or activities found in this Timeline export.')
      }
      progress('Loading map data', 0.08)
      const geo = await getGeocoder()
      const timeline = processTimeline(raw, geo, (s, p) => progress(s, 0.1 + p * 0.9))
      post({ id, type: 'timeline', timeline, name: file.name })
    } else {
      throw new ImportError(
        'Unrecognised file. Import a Flighty CSV export or a Google Maps Timeline JSON export.',
      )
    }
  } catch (e) {
    post({ id, type: 'error', message: e instanceof Error ? e.message : String(e) })
  }
}
