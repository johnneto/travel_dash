import Papa from 'papaparse'
import { DateTime } from 'luxon'
import type { Airport, Flight } from '../../types'
import { haversineKm } from '../geo'

export const FLIGHTY_REQUIRED_COLUMNS = ['Date', 'Airline', 'Flight', 'From', 'To'] as const

export interface FlightyRow {
  Date: string
  Airline: string
  Flight: string
  From: string
  To: string
  Canceled?: string
  'Diverted To'?: string
  'Gate Departure (Scheduled)'?: string
  'Gate Departure (Actual)'?: string
  'Take off (Scheduled)'?: string
  'Take off (Actual)'?: string
  'Landing (Scheduled)'?: string
  'Landing (Actual)'?: string
  'Gate Arrival (Scheduled)'?: string
  'Gate Arrival (Actual)'?: string
  'Aircraft Type Name'?: string
  'Tail Number'?: string
  Seat?: string
  'Seat Type'?: string
  'Cabin Class'?: string
  'Flight Reason'?: string
  'Flight Flighty ID'?: string
}

export class ImportError extends Error {}

export function parseFlightyCsv(text: string): FlightyRow[] {
  const res = Papa.parse<FlightyRow>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const fields = res.meta.fields ?? []
  const missing = FLIGHTY_REQUIRED_COLUMNS.filter((c) => !fields.includes(c))
  if (missing.length) {
    throw new ImportError(
      `This doesn't look like a Flighty export — missing column(s): ${missing.join(', ')}.`,
    )
  }
  return res.data.filter((r) => r.Date && r.From && r.To)
}

const clean = (s: string | undefined) => (s ?? '').trim()

function toUtc(local: string | undefined, tz: string | undefined): number | null {
  const v = clean(local)
  if (!v) return null
  const dt = DateTime.fromISO(v, { zone: tz || 'UTC' })
  return dt.isValid ? dt.toMillis() : null
}

const minutes = (a: number | null, b: number | null) =>
  a != null && b != null ? Math.round((b - a) / 60000) : null

function tailFormat(t: string): string {
  const s = t.toUpperCase().replace(/\s/g, '')
  // Flighty sometimes drops the dash on Brazilian regs (PRMHE -> PR-MHE).
  if (/^(PR|PP|PT|PS|PU)[A-Z]{3}$/.test(s)) return `${s.slice(0, 2)}-${s.slice(2)}`
  return s
}

export function enrichFlights(
  rows: FlightyRow[],
  airports: Record<string, Airport>,
  airlines: Record<string, { name: string }>,
): { flights: Flight[]; unknownAirports: string[] } {
  const unknown = new Set<string>()
  const flights: Flight[] = []
  rows.forEach((r, i) => {
    const from = clean(r.From).toUpperCase()
    const to = clean(r.To).toUpperCase()
    const diverted = clean(r['Diverted To']).toUpperCase() || null
    const a = airports[from]
    const b = airports[diverted ?? to] ?? airports[to]
    if (!a) unknown.add(from)
    if (!b) unknown.add(to)
    if (!a || !b) return

    const depSched = toUtc(r['Gate Departure (Scheduled)'], a.tz)
    const depActual = toUtc(r['Gate Departure (Actual)'], a.tz)
    const takeoff = toUtc(r['Take off (Actual)'], a.tz) ?? toUtc(r['Take off (Scheduled)'], a.tz)
    const landing = toUtc(r['Landing (Actual)'], b.tz) ?? toUtc(r['Landing (Scheduled)'], b.tz)
    const arrSched = toUtc(r['Gate Arrival (Scheduled)'], b.tz)
    const arrActual = toUtc(r['Gate Arrival (Actual)'], b.tz)
    const dep = depActual ?? depSched ?? takeoff
    const arr = arrActual ?? arrSched ?? landing
    const takeoffActual = toUtc(r['Take off (Actual)'], a.tz)

    const depLocal = clean(r['Gate Departure (Actual)']) || clean(r['Gate Departure (Scheduled)'])
    const depLocalHour = depLocal ? DateTime.fromISO(depLocal).hour : null

    const offsetAt = (tz: string, ms: number | null) =>
      ms == null ? 0 : DateTime.fromMillis(ms, { zone: tz }).offset / 60

    // Reject durations that are physically implausible (bad/missing times in the export):
    // faster than ~950 km/h cruise or longer than 24 h.
    const distanceKm = haversineKm(a.lat, a.lon, b.lat, b.lon)
    const minAir = (distanceKm / 950) * 60
    let duration = minutes(dep, arr)
    if (duration != null && (duration < minAir + 10 || duration > 24 * 60)) duration = null
    let air = minutes(takeoff, landing)
    if (air != null && (air < minAir || air > 24 * 60)) air = null
    const taxi = minutes(depActual, takeoffActual)

    const airline = clean(r.Airline).toUpperCase()
    flights.push({
      id: clean(r['Flight Flighty ID']) || `${r.Date}-${airline}${r.Flight}-${from}-${to}-${i}`,
      date: clean(r.Date),
      airline,
      airlineName: airlines[airline]?.name ?? airline,
      flightNo: `${airline} ${clean(r.Flight)}`,
      from,
      to,
      divertedTo: diverted,
      canceled: clean(r.Canceled).toLowerCase() === 'true',
      depSched,
      depActual,
      takeoff,
      landing,
      arrSched,
      arrActual,
      dep,
      arr,
      depLocalHour,
      depLocalTime: depLocal ? depLocal.slice(11, 16) : null,
      aircraft: clean(r['Aircraft Type Name']),
      tail: tailFormat(clean(r['Tail Number'])),
      seat: clean(r.Seat),
      seatType: clean(r['Seat Type']).toLowerCase(),
      cabin: clean(r['Cabin Class']).toLowerCase().replace(/_/g, ' '),
      reason: clean(r['Flight Reason']).toLowerCase(),
      distanceKm: Math.round(distanceKm),
      durationMin: duration,
      airMin: air,
      depDelayMin: minutes(depSched, depActual),
      arrDelayMin: minutes(arrSched, arrActual),
      taxiOutMin: taxi != null && taxi >= 0 && taxi < 240 ? taxi : null,
      tzShiftH: Math.round((offsetAt(b.tz, arr) - offsetAt(a.tz, dep)) * 10) / 10,
      fromCc: a.cc,
      toCc: b.cc,
    })
  })
  flights.sort((x, y) => (x.dep ?? 0) - (y.dep ?? 0) || x.date.localeCompare(y.date))
  return { flights, unknownAirports: [...unknown] }
}
