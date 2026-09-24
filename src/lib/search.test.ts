import { describe, expect, it } from 'vitest'
import { normalize, searchPlaces } from './search'
import type { CityStat, PlaceStat } from './stats'
import type { CountryInfo, TimelineData } from '../types'

const country = (code: string, name: string, region = 'Europe', subregion = ''): CountryInfo => ({
  code,
  name,
  flag: '',
  region,
  subregion,
  lat: 0,
  lon: 0,
  area: 0,
  unMember: true,
  ccn3: '',
})
const countries = {
  PT: country('PT', 'Portugal'),
  BR: country('BR', 'Brazil', 'Americas', 'South America'),
  ES: country('ES', 'Spain'),
}

const tl = {
  cities: [
    { name: 'Lisbon', cc: 'PT', lat: 38.7, lon: -9.1, pop: 500000 },
    { name: 'São Paulo', cc: 'BR', lat: -23.5, lon: -46.6, pop: 12000000 },
    { name: 'Madrid', cc: 'ES', lat: 40.4, lon: -3.7, pop: 3000000 },
    { name: 'Vila Nova de Lisboa', cc: 'PT', lat: 39, lon: -9, pop: 1000 },
  ],
  places: [
    { id: 'a', lat: 38.7, lon: -9.1, city: 0, cc: 'PT', sem: 'Home' },
    { id: 'b', lat: 38.71, lon: -9.12, city: 0, cc: 'PT', sem: 'Work' },
    { id: 'c', lat: -23.5, lon: -46.6, city: 1, cc: 'BR', sem: 'Unknown' },
    { id: 'd', lat: 40.4, lon: -3.7, city: 2, cc: 'ES', sem: 'Work' },
    { id: 'e', lat: 39, lon: -9, city: 3, cc: 'PT', sem: 'Unknown' },
  ],
} as unknown as TimelineData

const cityStat = (idx: number, days: number): CityStat => ({
  idx,
  days,
  hours: days * 10,
  visits: days,
  first: '2024-01-01',
  last: '2024-02-01',
})
const cities = [cityStat(0, 100), cityStat(2, 10), cityStat(1, 5), cityStat(3, 2)]
const placeStat = (p: number, hours: number): PlaceStat => {
  const sem = tl.places[p].sem
  return { p, hours, visits: 1, first: 0, last: 0, sem, sems: sem === 'Unknown' ? [] : [sem] }
}
const places = [
  placeStat(0, 900),
  placeStat(1, 300),
  placeStat(3, 40),
  placeStat(2, 20),
  placeStat(4, 5),
]

const search = (q: string) =>
  searchPlaces(q, tl, cities, places, countries).map((r) => ({
    city: tl.cities[r.city.idx].name,
    places: r.places.map((s) => tl.places[s.p].id),
  }))

describe('searchPlaces', () => {
  it('returns nothing for an empty query', () => {
    expect(search('  ')).toEqual([])
  })

  it('matches city names ignoring case and accents', () => {
    expect(search('sao paulo')).toEqual([{ city: 'São Paulo', places: ['c'] }])
    expect(normalize('São Paulo')).toBe('sao paulo')
  })

  it('ranks cities whose name starts with the query first', () => {
    expect(search('lisbo').map((r) => r.city)).toEqual(['Lisbon', 'Vila Nova de Lisboa'])
  })

  it('matches by country and continent', () => {
    expect(search('portugal').map((r) => r.city)).toEqual(['Lisbon', 'Vila Nova de Lisboa'])
    expect(search('south america').map((r) => r.city)).toEqual(['São Paulo'])
  })

  it('narrows to places of a given type', () => {
    expect(search('work')).toEqual([
      { city: 'Lisbon', places: ['b'] },
      { city: 'Madrid', places: ['d'] },
    ])
    expect(search('work spain')).toEqual([{ city: 'Madrid', places: ['d'] }])
  })

  it('requires every word to match', () => {
    expect(search('madrid portugal')).toEqual([])
  })
})
