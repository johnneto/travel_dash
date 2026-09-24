import { describe, expect, it } from 'vitest'
import { enrichFlights, ImportError, parseFlightyCsv } from './flighty'
import type { Airport } from '../../types'

const HEADER =
  'Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID'

const airports: Record<string, Airport> = {
  MAD: {
    iata: 'MAD',
    name: 'Madrid Barajas',
    city: 'Madrid',
    cc: 'ES',
    lat: 40.4719,
    lon: -3.5626,
    tz: 'Europe/Madrid',
  },
  LHR: {
    iata: 'LHR',
    name: 'Heathrow',
    city: 'London',
    cc: 'GB',
    lat: 51.4706,
    lon: -0.4619,
    tz: 'Europe/London',
  },
  DXB: {
    iata: 'DXB',
    name: 'Dubai Intl',
    city: 'Dubai',
    cc: 'AE',
    lat: 25.2528,
    lon: 55.3644,
    tz: 'Asia/Dubai',
  },
}

describe('parseFlightyCsv', () => {
  it('rejects files without the Flighty columns', () => {
    expect(() => parseFlightyCsv('a,b,c\n1,2,3')).toThrow(ImportError)
  })

  it('enriches flights with UTC times, distance and delays', () => {
    const csv = [
      HEADER,
      '2024-05-01,IBE,3166,MAD,LHR,4,J1,5,,false,,2024-05-01T10:00,2024-05-01T10:20,,2024-05-01T10:35,,2024-05-01T11:50,2024-05-01T12:00,2024-05-01T12:05,Airbus A321neo,ECNXA,,12A,WINDOW,ECONOMY,LEISURE,,id-1,,,,,',
    ].join('\n')
    const { flights, unknownAirports } = enrichFlights(parseFlightyCsv(csv), airports, {
      IBE: { name: 'Iberia' },
    })
    expect(unknownAirports).toEqual([])
    const f = flights[0]
    expect(f.airlineName).toBe('Iberia')
    expect(f.distanceKm).toBeGreaterThan(1200)
    expect(f.distanceKm).toBeLessThan(1300)
    // 10:20 Madrid (UTC+2) -> 12:05 London (UTC+1) = 2h45 gate to gate
    expect(f.durationMin).toBe(165)
    expect(f.depDelayMin).toBe(20)
    expect(f.arrDelayMin).toBe(5)
    expect(f.taxiOutMin).toBe(15)
    expect(f.tzShiftH).toBe(-1)
    expect(f.depLocalTime).toBe('10:20')
    expect(f.seatType).toBe('window')
  })

  it('skips unknown airports and reports them', () => {
    const csv = [
      HEADER,
      '2024-05-01,IBE,1,MAD,XXX,,,,,false,,2024-05-01T10:00,,,,,,,,,,,,,,,,id-2,,,,,',
    ].join('\n')
    const { flights, unknownAirports } = enrichFlights(parseFlightyCsv(csv), airports, {})
    expect(flights).toHaveLength(0)
    expect(unknownAirports).toEqual(['XXX'])
  })

  it('discards physically impossible durations', () => {
    const csv = [
      HEADER,
      '2024-05-01,UAE,1,DXB,LHR,,,,,false,,2024-05-01T08:00,,,,,,2024-05-01T08:30,,,,,,,,,,id-3,,,,,',
    ].join('\n')
    const { flights } = enrichFlights(parseFlightyCsv(csv), airports, {})
    expect(flights[0].durationMin).toBeNull()
  })
})
