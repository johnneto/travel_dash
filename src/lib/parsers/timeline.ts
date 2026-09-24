import type { TravelMode } from '../../types'
import { parseLatLng } from '../geo'
import { ImportError } from './flighty'

export interface RawVisit {
  s: number
  e: number
  off: number | null
  lat: number
  lon: number
  placeId: string
  sem: string
}
export interface RawActivity {
  s: number
  e: number
  off: number | null
  a: [number, number]
  b: [number, number]
  km: number
  mode: TravelMode
}
export interface RawPoint {
  t: number
  lat: number
  lon: number
}
export interface RawMemory {
  s: number
  e: number
  km: number
}
export interface RawTimeline {
  format: 'ios' | 'android'
  visits: RawVisit[]
  activities: RawActivity[]
  points: RawPoint[]
  memories: RawMemory[]
  entries: number
}

/** UTC offset in minutes from an ISO string, or null for "Z"/missing. */
export function isoOffset(s: string): number | null {
  const m = /([+-])(\d{2}):?(\d{2})$/.exec(s)
  if (!m) return null
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
}

const MODE_MAP: Record<string, TravelMode> = {
  'in passenger vehicle': 'car',
  'in vehicle': 'car',
  'in road vehicle': 'car',
  driving: 'car',
  'in taxi': 'car',
  walking: 'walking',
  'on foot': 'walking',
  running: 'running',
  cycling: 'cycling',
  'in bus': 'bus',
  'in subway': 'subway',
  'in train': 'train',
  'in rail vehicle': 'train',
  'in tram': 'tram',
  'in ferry': 'ferry',
  flying: 'flying',
  motorcycling: 'motorcycle',
  sailing: 'boat',
  'in boat': 'boat',
  skiing: 'skiing',
}

export function normalizeMode(raw: string | undefined): TravelMode {
  const k = (raw ?? '').toLowerCase().replace(/_/g, ' ').trim()
  return MODE_MAP[k] ?? 'unknown'
}

export function normalizeSemantic(raw: string | undefined): string {
  const s = (raw ?? 'Unknown').replace(/_/g, ' ').toLowerCase()
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

type Json = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Parse a Google Maps Timeline export. Supports:
 *  - the on-device iOS export (a JSON array of visit / activity / timelinePath / timelineMemory)
 *  - the on-device Android export ({ semanticSegments: [...] })
 */
export function parseTimeline(data: unknown): RawTimeline {
  let segments: Json[]
  let format: RawTimeline['format']
  if (Array.isArray(data)) {
    segments = data as Json[]
    format = 'ios'
  } else if (data && typeof data === 'object' && Array.isArray((data as Json).semanticSegments)) {
    segments = (data as Json).semanticSegments as Json[]
    format = 'android'
  } else if (data && typeof data === 'object' && 'timelineObjects' in (data as Json)) {
    throw new ImportError(
      'This is the old Google Takeout monthly format. Export the Timeline from the Google Maps app instead (Settings → Location & privacy → Export Timeline data).',
    )
  } else {
    throw new ImportError("This doesn't look like a Google Maps Timeline export.")
  }

  const out: RawTimeline = {
    format,
    visits: [],
    activities: [],
    points: [],
    memories: [],
    entries: 0,
  }

  for (const seg of segments) {
    const st = str(seg.startTime)
    const et = str(seg.endTime)
    const s = Date.parse(st)
    const e = Date.parse(et)
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue
    out.entries++
    const off =
      seg.startTimeTimezoneUtcOffsetMinutes != null
        ? num(seg.startTimeTimezoneUtcOffsetMinutes)
        : isoOffset(st)

    if (seg.visit) {
      const v = seg.visit as Json
      const tc = (v.topCandidate ?? {}) as Json
      const loc =
        typeof tc.placeLocation === 'string'
          ? parseLatLng(tc.placeLocation)
          : parseLatLng(str((tc.placeLocation as Json | undefined)?.latLng))
      if (!loc) continue
      out.visits.push({
        s,
        e,
        off,
        lat: loc[0],
        lon: loc[1],
        placeId: str(tc.placeID ?? tc.placeId) || `${loc[0].toFixed(4)},${loc[1].toFixed(4)}`,
        sem: normalizeSemantic(str(tc.semanticType)),
      })
    } else if (seg.activity) {
      const a = seg.activity as Json
      const start =
        typeof a.start === 'string'
          ? parseLatLng(a.start)
          : parseLatLng(str((a.start as Json)?.latLng))
      const end =
        typeof a.end === 'string' ? parseLatLng(a.end) : parseLatLng(str((a.end as Json)?.latLng))
      if (!start || !end) continue
      out.activities.push({
        s,
        e,
        off,
        a: start,
        b: end,
        km: num(a.distanceMeters) / 1000,
        mode: normalizeMode(str((a.topCandidate as Json | undefined)?.type)),
      })
    } else if (Array.isArray(seg.timelinePath)) {
      for (const p of seg.timelinePath as Json[]) {
        const ll = parseLatLng(str(p.point))
        if (!ll) continue
        const t =
          p.time != null
            ? Date.parse(str(p.time))
            : s + num(p.durationMinutesOffsetFromStartTime) * 60000
        if (Number.isFinite(t)) out.points.push({ t, lat: ll[0], lon: ll[1] })
      }
    } else if (seg.timelineMemory) {
      const m = seg.timelineMemory as Json
      const trip = (m.trip ?? m) as Json
      out.memories.push({ s, e, km: num(trip.distanceFromOriginKms) })
    }
  }
  out.visits.sort((x, y) => x.s - y.s)
  out.activities.sort((x, y) => x.s - y.s)
  out.points.sort((x, y) => x.t - y.t)
  return out
}
