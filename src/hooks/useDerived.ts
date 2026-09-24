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
    const ov = overview(fd, tl, ref.countries, cStats)
    const fStats = flightStats(fd.flights)
    const mStats = movementStats(fd.activities, fd.flights)
    const cities = cityStats(fd, tl)
    const places = placeStats(fd)
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
      ov,
      fStats,
      mStats,
      cities,
      places,
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
