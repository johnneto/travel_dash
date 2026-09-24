export const EARTH_RADIUS_KM = 6371.0088
export const EARTH_CIRCUMFERENCE_KM = 40075
export const MOON_DISTANCE_KM = 384400

const toRad = (d: number) => (d * Math.PI) / 180
const toDeg = (r: number) => (r * 180) / Math.PI

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Geographic midpoint of two points along the great circle. */
export function midpoint(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const λ1 = toRad(lon1)
  const dλ = toRad(lon2 - lon1)
  const bx = Math.cos(φ2) * Math.cos(dλ)
  const by = Math.cos(φ2) * Math.sin(dλ)
  const φ3 = Math.atan2(Math.sin(φ1) + Math.sin(φ2), Math.sqrt((Math.cos(φ1) + bx) ** 2 + by ** 2))
  const λ3 = λ1 + Math.atan2(by, Math.cos(φ1) + bx)
  return { lat: toDeg(φ3), lon: ((toDeg(λ3) + 540) % 360) - 180 }
}

/** Mean centre of a set of points on the sphere (handles the antimeridian). */
export function centroid(points: { lat: number; lon: number }[]) {
  if (!points.length) return { lat: 0, lon: 0 }
  let x = 0
  let y = 0
  let z = 0
  for (const p of points) {
    const φ = toRad(p.lat)
    const λ = toRad(p.lon)
    x += Math.cos(φ) * Math.cos(λ)
    y += Math.cos(φ) * Math.sin(λ)
    z += Math.sin(φ)
  }
  const n = points.length
  x /= n
  y /= n
  z /= n
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lon: toDeg(Math.atan2(y, x)) }
}

/** Parse "geo:-23.25,-45.88" (iOS export) or "-23.25°, -45.88°" (Android export). */
export function parseLatLng(s: string | undefined | null): [number, number] | null {
  if (!s) return null
  const m = s.replace('geo:', '').replace(/°/g, '').split(',')
  if (m.length < 2) return null
  const lat = Number(m[0])
  const lon = Number(m[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return [lat, lon]
}

/** A globe altitude (in globe radii) that frames a span of `km`. */
export function altitudeForSpan(km: number): number {
  return Math.min(3.2, Math.max(0.35, km / 3500))
}
