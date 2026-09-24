import KDBush from 'kdbush'
import { around } from 'geokdbush'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import type { City } from '../types'

export type RawCity = [name: string, cc: string, lat: number, lon: number, pop: number]

interface CountryPoly {
  cc: string
  bbox: [number, number, number, number] // minLon, minLat, maxLon, maxLat
  rings: number[][][][] // polygons -> rings -> points
}

/** Natural Earth features that have no ISO numeric id in world-atlas. */
const NAME_FALLBACK: Record<string, string> = {
  'N. Cyprus': 'CY',
  Somaliland: 'SO',
  Kosovo: 'XK',
}

function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Offline reverse geocoder: nearest (population-weighted) GeoNames city and
 * Natural Earth country polygon lookup. Results are cached on a ~1 km grid.
 */
export class ReverseGeocoder {
  readonly cities: RawCity[]
  private index: KDBush
  private polys: CountryPoly[] = []
  private countryCache = new Map<string, string>()
  private cityCache = new Map<string, number>()

  constructor(cities: RawCity[], topo: Topology, ccn3ToCca2: Record<string, string>) {
    this.cities = cities
    this.index = new KDBush(cities.length)
    for (const c of cities) this.index.add(c[3], c[2])
    this.index.finish()

    const fc = feature(topo, topo.objects.countries as GeometryCollection)
    for (const f of (
      fc as unknown as { features: Feature<Polygon | MultiPolygon, { name: string }>[] }
    ).features) {
      const cc = ccn3ToCca2[String(f.id)] ?? NAME_FALLBACK[f.properties?.name ?? '']
      if (!cc || !f.geometry) continue
      const polys =
        f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
      for (const rings of polys) {
        let minX = 180
        let minY = 90
        let maxX = -180
        let maxY = -90
        for (const [x, y] of rings[0]) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
        this.polys.push({ cc, bbox: [minX, minY, maxX, maxY], rings: [rings] })
      }
    }
  }

  private polygonCountry(lat: number, lon: number): string | null {
    for (const p of this.polys) {
      const b = p.bbox
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue
      for (const rings of p.rings) {
        if (!pointInRing(lon, lat, rings[0])) continue
        let inHole = false
        for (let h = 1; h < rings.length; h++) if (pointInRing(lon, lat, rings[h])) inHole = true
        if (!inHole) return p.cc
      }
    }
    return null
  }

  /**
   * Index of the city that best represents a location, or -1.
   * Uses a gravity score (population / distance²) among cities within 35 km,
   * so a point in a big metro maps to the metro unless a town is right there.
   */
  city(lat: number, lon: number): number {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
    const hit = this.cityCache.get(key)
    if (hit !== undefined) return hit
    const ids = around(this.index, lon, lat, 25, 35) as unknown as number[]
    let best = -1
    let bestScore = -1
    for (const id of ids) {
      const c = this.cities[id]
      const d = haversine(lat, lon, c[2], c[3])
      const score = Math.max(c[4], 1000) / (d + 2) ** 2
      if (score > bestScore) {
        bestScore = score
        best = id
      }
    }
    if (best === -1) {
      // Remote area: fall back to the nearest city within 150 km.
      const far = around(this.index, lon, lat, 1, 150) as unknown as number[]
      best = far.length ? far[0] : -1
    }
    this.cityCache.set(key, best)
    return best
  }

  /** ISO 3166-1 alpha-2 of the location, or '' when at sea / unknown. */
  country(lat: number, lon: number): string {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`
    const hit = this.countryCache.get(key)
    if (hit !== undefined) return hit
    let cc = this.polygonCountry(lat, lon)
    if (!cc) {
      // Coastlines at 1:50m are coarse: snap to the nearest city within 25 km.
      const near = around(this.index, lon, lat, 1, 25) as unknown as number[]
      cc = near.length ? this.cities[near[0]][1] : ''
    }
    this.countryCache.set(key, cc)
    return cc
  }

  toCity(idx: number): City {
    const c = this.cities[idx]
    return { name: c[0], cc: c[1], lat: c[2], lon: c[3], pop: c[4] }
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(a))
}
