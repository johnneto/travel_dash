import { describe, expect, it } from 'vitest'
import { isoOffset, normalizeMode, parseTimeline } from './timeline'
import { ImportError } from './flighty'

describe('parseTimeline', () => {
  it('parses the iOS array export', () => {
    const raw = parseTimeline([
      {
        startTime: '2024-01-01T10:00:00.000+01:00',
        endTime: '2024-01-01T12:00:00.000+01:00',
        visit: {
          topCandidate: { semanticType: 'Home', placeID: 'abc', placeLocation: 'geo:40.4,-3.7' },
        },
      },
      {
        startTime: '2024-01-01T12:00:00.000+01:00',
        endTime: '2024-01-01T12:30:00.000+01:00',
        activity: {
          start: 'geo:40.4,-3.7',
          end: 'geo:40.5,-3.6',
          distanceMeters: '5000',
          topCandidate: { type: 'in subway' },
        },
      },
      {
        startTime: '2024-01-01T10:00:00.000Z',
        endTime: '2024-01-01T12:00:00.000Z',
        timelinePath: [{ point: 'geo:40.41,-3.71', durationMinutesOffsetFromStartTime: '30' }],
      },
    ])
    expect(raw.format).toBe('ios')
    expect(raw.visits[0]).toMatchObject({
      lat: 40.4,
      lon: -3.7,
      placeId: 'abc',
      sem: 'Home',
      off: 60,
    })
    expect(raw.activities[0]).toMatchObject({ mode: 'subway', km: 5 })
    expect(raw.points[0].t).toBe(Date.parse('2024-01-01T10:30:00Z'))
  })

  it('parses the Android semanticSegments export', () => {
    const raw = parseTimeline({
      semanticSegments: [
        {
          startTime: '2024-01-01T10:00:00.000+04:00',
          endTime: '2024-01-01T11:00:00.000+04:00',
          startTimeTimezoneUtcOffsetMinutes: 240,
          visit: {
            topCandidate: {
              placeId: 'p1',
              semanticType: 'INFERRED_HOME',
              placeLocation: { latLng: '25.2°, 55.3°' },
            },
          },
        },
        {
          startTime: '2024-01-01T11:00:00.000+04:00',
          endTime: '2024-01-01T11:30:00.000+04:00',
          activity: {
            start: { latLng: '25.2°, 55.3°' },
            end: { latLng: '25.3°, 55.4°' },
            distanceMeters: 12000,
            topCandidate: { type: 'IN_PASSENGER_VEHICLE' },
          },
        },
      ],
    })
    expect(raw.format).toBe('android')
    expect(raw.visits[0]).toMatchObject({ sem: 'Inferred Home', off: 240, lat: 25.2 })
    expect(raw.activities[0].mode).toBe('car')
  })

  it('rejects the legacy Takeout format with guidance', () => {
    expect(() => parseTimeline({ timelineObjects: [] })).toThrow(ImportError)
    expect(() => parseTimeline({ foo: 1 })).toThrow(/Timeline/)
  })

  it('helpers', () => {
    expect(isoOffset('2020-01-01T00:00:00-03:00')).toBe(-180)
    expect(isoOffset('2020-01-01T00:00:00Z')).toBeNull()
    expect(normalizeMode('IN_TRAIN')).toBe('train')
    expect(normalizeMode('hovercraft')).toBe('unknown')
  })
})
