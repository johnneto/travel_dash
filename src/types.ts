// ---------- Reference data ----------
export interface CountryInfo {
  code: string
  name: string
  flag: string
  region: string
  subregion: string
  lat: number
  lon: number
  area: number
  unMember: boolean
  ccn3: string
}

export interface Airport {
  iata: string
  name: string
  city: string
  cc: string
  lat: number
  lon: number
  tz: string
}

// ---------- Flights ----------
export interface Flight {
  id: string
  date: string // local departure date YYYY-MM-DD
  airline: string // ICAO code as exported by Flighty
  airlineName: string
  flightNo: string
  from: string
  to: string
  divertedTo: string | null
  canceled: boolean
  /** UTC epoch ms. `null` when unknown. */
  depSched: number | null
  depActual: number | null
  takeoff: number | null
  landing: number | null
  arrSched: number | null
  arrActual: number | null
  /** Best-known gate departure / arrival (actual, else scheduled). */
  dep: number | null
  arr: number | null
  depLocalHour: number | null
  depLocalTime: string | null // HH:MM at origin
  aircraft: string
  tail: string
  seat: string
  seatType: string
  cabin: string
  reason: string
  distanceKm: number
  durationMin: number | null
  airMin: number | null
  depDelayMin: number | null
  arrDelayMin: number | null
  taxiOutMin: number | null
  tzShiftH: number
  fromCc: string
  toCc: string
}

// ---------- Timeline ----------
export type TravelMode =
  | 'car'
  | 'walking'
  | 'running'
  | 'cycling'
  | 'bus'
  | 'subway'
  | 'train'
  | 'tram'
  | 'ferry'
  | 'flying'
  | 'motorcycle'
  | 'boat'
  | 'skiing'
  | 'unknown'

export interface City {
  name: string
  cc: string
  lat: number
  lon: number
  pop: number
}

export interface Place {
  id: string
  lat: number
  lon: number
  city: number // index into TimelineData.cities (-1 if none)
  cc: string
  sem: string
}

export interface Visit {
  s: number
  e: number
  off: number // UTC offset (minutes) at the visit
  p: number // index into places
  sem: string
}

export interface Activity {
  s: number
  e: number
  off: number
  mode: TravelMode
  km: number
  a: [number, number] // [lat, lon]
  b: [number, number]
  ccA: string
  ccB: string
}

export interface Day {
  d: string // local YYYY-MM-DD
  cc: string[] // countries present
  ci: number[] // cities visited (from visits)
  far: number // max km from home that day
  home: number // home city index
}

export interface HomePeriod {
  from: string // YYYY-MM
  to: string
  city: number
  lat: number
  lon: number
}

export interface Trip {
  id: number
  start: string
  end: string
  days: number
  countries: string[]
  cities: number[] // ordered by first appearance
  maxKm: number
  mainCity: number
  home: number
}

export interface TimelineMemory {
  s: number
  e: number
  km: number
}

export interface TimelineData {
  cities: City[]
  places: Place[]
  visits: Visit[]
  activities: Activity[]
  days: Day[]
  homes: HomePeriod[]
  trips: Trip[]
  memories: TimelineMemory[]
  range: { start: number; end: number }
  stats: { entries: number; pathPoints: number; format: string }
}

// ---------- Persisted dataset ----------
export interface Dataset {
  version: number
  flights: Flight[]
  flightsImportedAt: string | null
  flightsFile: string | null
  timeline: TimelineData | null
  timelineImportedAt: string | null
  timelineFile: string | null
}

// ---------- UI state ----------
export interface DateRange {
  from: string | null // YYYY-MM-DD inclusive
  to: string | null
}

export type Selection =
  | { type: 'country'; cc: string }
  | { type: 'flight'; id: string }
  | { type: 'route'; from: string; to: string }
  | { type: 'airport'; code: string }
  | { type: 'trip'; id: number }
  | { type: 'city'; idx: number }
  | { type: 'point'; lat: number; lon: number; label: string }
  | null
