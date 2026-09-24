import { describe, expect, it } from 'vitest'
import { centroid, haversineKm, midpoint, parseLatLng } from './geo'

describe('geo', () => {
  it('computes great-circle distances', () => {
    // Madrid – London ≈ 1,264 km
    expect(Math.round(haversineKm(40.4168, -3.7038, 51.5074, -0.1278))).toBeGreaterThan(1250)
    expect(Math.round(haversineKm(40.4168, -3.7038, 51.5074, -0.1278))).toBeLessThan(1280)
  })
  it('handles the antimeridian in midpoints and centroids', () => {
    expect(Math.abs(midpoint(0, 179, 0, -179).lon)).toBeCloseTo(180, 0)
    expect(
      Math.abs(
        centroid([
          { lat: 0, lon: 179 },
          { lat: 0, lon: -179 },
        ]).lon,
      ),
    ).toBeCloseTo(180, 0)
  })
  it('parses both coordinate formats', () => {
    expect(parseLatLng('geo:-23.25,-45.88')).toEqual([-23.25, -45.88])
    expect(parseLatLng('41.1°, -8.6°')).toEqual([41.1, -8.6])
    expect(parseLatLng('nope')).toBeNull()
  })
})
