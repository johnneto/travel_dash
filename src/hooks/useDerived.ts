import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { crossReference } from '../lib/cross'
import {
  applyFilters,
  cityStats,
  countryStats,
  discoveryCurve,
  extremes,
  flightStats,
  movementStats,
  overview,
  HOME_WORK_SEMANTICS,
  placeStats,
} from '../lib/stats'
import { buildInsights } from '../lib/insights'

/** All filtered data + statistics the sections render, memoised on data & filters. */
export function useDerived() {
  const data = useStore((s) => s.data)
  const ref = useStore((s) => s.ref)!
  const range = useStore((s) => s.range)
  const country = useStore((s) => s.country)
  const tl = data.timeline

  const cross = useMemo(
    () => crossReference(data.flights, tl, ref.airports),
    [data.flights, tl, ref.airports],
  )
  const discovery = useMemo(() => discoveryCurve(tl, data.flights), [tl, data.flights])

  return useMemo(() => {
    const fd = applyFilters(data.flights, tl, { range, country })
    const cStats = countryStats(fd, tl)
    // The country list itself ignores the country filter (period only), so picking a country
    // highlights it instead of narrowing the list to its neighbours.
    const cStatsAll = country
      ? countryStats(applyFilters(data.flights, tl, { range, country: null }), tl)
      : cStats
    const ov = overview(fd, tl, ref.countries, cStats)
    const fStats = flightStats(fd.flights)
    const mStats = movementStats(fd.activities, fd.flights)
    const cities = cityStats(fd, tl)
    const places = placeStats(fd.visits)
    // Excludes visits by what the place was *at the time*: after moving, the old home counts
    // again, and the new one only stops counting once it became Home.
    const awayPlaces = placeStats(fd.visits, (v) => !HOME_WORK_SEMANTICS.has(v.sem))
    const ext = extremes(fd, tl)
    const homeCc = (() => {
      if (!tl)
        return data.flights.length
          ? fStats.airports[0] && ref.airports[fStats.airports[0][0]]?.cc
          : null
      const counts = new Map<string, number>()
      for (const d of tl.days) {
        const cc = tl.cities[d.home]?.cc
        if (cc) counts.set(cc, (counts.get(cc) ?? 0) + 1)
      }
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    })()
    const base = {
      fd,
      cStats,
      cStatsAll,
      ov,
      fStats,
      mStats,
      cities,
      places,
      awayPlaces,
      ext,
      cross,
      discovery,
      tl,
      ref,
      homeCc,
      range,
      country,
    }
    return { ...base, insights: buildInsights(base) }
  }, [data.flights, tl, range, country, ref, cross, discovery])
}

export type Derived = ReturnType<typeof useDerived>
