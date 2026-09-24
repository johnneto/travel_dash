import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ReverseGeocoder } from '../geocoder'
import { processTimeline } from './timeline'
import type { RawTimeline, RawVisit } from '../parsers/timeline'
import { crossReference } from '../cross'
import type { Airport, Flight } from '../../types'

const j = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'))
const countries = j('countries.json') as Record<string, { i: string }>
const ccn: Record<string, string> = {}
for (const [cc, c] of Object.entries(countries)) ccn[c.i] = cc
const geo = new ReverseGeocoder(j('cities.json'), j('countries-50m.json'), ccn)

const H = 3600000
const visit = (
  iso: string,
  hours: number,
  lat: number,
  lon: number,
  placeId: string,
  sem = 'Unknown',
): RawVisit => {
  const s = Date.parse(iso)
  return { s, e: s + hours * H, off: 60, lat, lon, placeId, sem }
}

describe('processTimeline', () => {
  const MAD = [40.4168, -3.7038] as const
  const LIS = [38.7223, -9.1393] as const
  const raw: RawTimeline = {
    format: 'ios',
    entries: 0,
    points: [],
    memories: [],
    activities: [
      {
        s: Date.parse('2024-03-10T09:00:00Z'),
        e: Date.parse('2024-03-10T10:10:00Z'),
        off: 60,
        a: [40.49, -3.57],
        b: [38.77, -9.13],
        km: 510,
        mode: 'flying',
      },
    ],
    visits: [
      ...Array.from({ length: 20 }, (_, i) =>
        visit(
          `2024-03-${String(i + 1).padStart(2, '0')}T20:00:00Z`,
          10,
          MAD[0],
          MAD[1],
          'home',
          'Home',
        ),
      ).filter((_, i) => i < 9 || i > 12),
      visit('2024-03-10T12:00:00Z', 20, LIS[0], LIS[1], 'hotel'),
      visit('2024-03-11T12:00:00Z', 6, LIS[0] + 0.01, LIS[1], 'museum'),
      visit('2024-03-12T09:00:00Z', 3, LIS[0], LIS[1], 'cafe'),
    ],
  }
  raw.visits.sort((a, b) => a.s - b.s)
  const tl = processTimeline(raw, geo)

  it('geocodes cities and countries', () => {
    const names = tl.cities.map((c) => c.name)
    expect(names).toContain('Madrid')
    expect(names).toContain('Lisbon')
    expect(tl.places.find((p) => p.id === 'hotel')?.cc).toBe('PT')
  })

  it('detects home and a single trip to Lisbon', () => {
    expect(tl.cities[tl.homes[0].city].name).toBe('Madrid')
    expect(tl.trips).toHaveLength(1)
    const t = tl.trips[0]
    expect(t.start).toBe('2024-03-10')
    expect(t.end).toBe('2024-03-12')
    expect(t.countries).toContain('PT')
    expect(tl.cities[t.mainCity].name).toBe('Lisbon')
  })

  it('cross-references a Flighty flight with the timeline', () => {
    const airports: Record<string, Airport> = {
      MAD: {
        iata: 'MAD',
        name: '',
        city: 'Madrid',
        cc: 'ES',
        lat: 40.4719,
        lon: -3.5626,
        tz: 'Europe/Madrid',
      },
      LIS: {
        iata: 'LIS',
        name: '',
        city: 'Lisbon',
        cc: 'PT',
        lat: 38.7742,
        lon: -9.1342,
        tz: 'Europe/Lisbon',
      },
    }
    const f = {
      id: 'f1',
      date: '2024-03-10',
      from: 'MAD',
      to: 'LIS',
      divertedTo: null,
      dep: Date.parse('2024-03-10T08:50:00Z'),
      arr: Date.parse('2024-03-10T10:20:00Z'),
    } as Flight
    const cross = crossReference([f], tl, airports, Date.parse('2025-01-01'))
    expect(cross.matches.get('f1')?.evidence).toBe('flying')
    expect(cross.matches.get('f1')?.tripId).toBe(0)
    expect(cross.unlogged).toHaveLength(0)
  })
})
