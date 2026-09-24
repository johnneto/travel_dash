import type { CountryInfo, TimelineData } from '../types'
import { continentOf } from './refdata'
import type { CityStat, PlaceStat } from './stats'

export interface PlaceSearchResult {
  city: CityStat
  /** Visited places in the city, most time spent first. Narrowed to the matches when the query names a place type. */
  places: PlaceStat[]
}

/** Lower-cases and strips diacritics so "sao paulo" finds "São Paulo". */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

/**
 * Searches the cities and places in the Timeline. Google's export has no place names, so a
 * place is matched on its city, country, continent and semantic type (Home, Work…).
 * Every word of the query must match one of those fields.
 */
export function searchPlaces(
  query: string,
  tl: TimelineData,
  cities: CityStat[],
  places: PlaceStat[],
  countries: Record<string, CountryInfo>,
  limit = 25,
): PlaceSearchResult[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []

  const byCity = new Map<number, PlaceStat[]>()
  for (const s of places) {
    const ci = tl.places[s.p].city
    byCity.set(ci, [...(byCity.get(ci) ?? []), s])
  }

  const results: (PlaceSearchResult & { rank: number })[] = []
  for (const city of cities) {
    const c = tl.cities[city.idx]
    if (!c) continue
    const country = countries[c.cc]
    const cityFields = [c.name, country?.name ?? c.cc, country ? continentOf(country) : '']
      .map(normalize)
      .join(' ')
    const inCity = byCity.get(city.idx) ?? []
    // Words not found in the city's own fields must all match a place type in that city.
    const rest = words.filter((w) => !cityFields.includes(w))
    const typed = rest.length
      ? inCity.filter((s) => {
          const sem = normalize(s.sems.join(' '))
          return rest.every((w) => sem.includes(w))
        })
      : inCity
    if (rest.length && !typed.length) continue
    const name = normalize(c.name)
    const rank = name.startsWith(words[0]) ? 0 : name.includes(words[0]) ? 1 : 2
    results.push({ city, places: typed, rank })
  }
  return results
    .sort((a, b) => a.rank - b.rank || b.city.days - a.city.days || b.city.hours - a.city.hours)
    .slice(0, limit)
    .map(({ city, places }) => ({ city, places }))
}
