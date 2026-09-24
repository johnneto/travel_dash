import { useEffect, useMemo, useRef, useState } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { MeshPhongMaterial, Color } from 'three'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, Geometry } from 'geojson'
import { useStore } from '../store/useStore'
import { useColors } from '../hooks/ThemeContext'
import type { Derived } from '../hooks/useDerived'
import { getJson } from '../lib/refdata'
import { altitudeForSpan, centroid, haversineKm, midpoint } from '../lib/geo'
import { localDate } from '../lib/process/timeline'
import { routeKey } from '../lib/stats'
import { fmtKm, plural } from '../lib/format'

type CountryFeature = Feature<Geometry, { name: string; cc: string }>

const NAME_FALLBACK: Record<string, string> = { 'N. Cyprus': 'CY', Somaliland: 'SO', Kosovo: 'XK' }

function rgba(hex: string, a: number) {
  const c = new Color(hex)
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    )
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

interface ArcDatum {
  key: string
  from: string
  to: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  count: number
  km: number
  hot: boolean
}

interface PointDatum {
  lat: number
  lng: number
  name: string
  days: number
  idx: number
}

const tooltip = (bg: string, fg: string, border: string, html: string) =>
  `<div style="background:${bg};color:${fg};border:1px solid ${border};padding:6px 10px;border-radius:8px;font:12px Inter,system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.15)">${html}</div>`

export default function GlobeView({ d }: { d: Derived }) {
  const c = useColors()
  const globe = useRef<GlobeMethods | undefined>(undefined)
  const [wrap, size] = useSize<HTMLDivElement>()
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const setCountry = useStore((s) => s.setCountry)
  const country = useStore((s) => s.country)
  const [features, setFeatures] = useState<CountryFeature[]>([])
  const [hoverCc, setHoverCc] = useState<string | null>(null)
  // Marker sizes are in globe degrees, so shrink them as the camera zooms in.
  const [alt, setAlt] = useState(2.3)
  const k = Math.min(1, Math.max(0.06, alt / 2.3))
  const { ref, tl, fd, cStats, cities } = d

  useEffect(() => {
    const byNum: Record<string, string> = {}
    for (const ci of Object.values(ref.countries)) byNum[ci.ccn3] = ci.code
    getJson<Topology>('countries-110m.json').then((topo) => {
      const fc = feature(topo, topo.objects.countries as GeometryCollection) as unknown as {
        features: Feature<Geometry, { name: string }>[]
      }
      setFeatures(
        fc.features
          .map((f) => ({
            ...f,
            properties: {
              name: f.properties.name,
              cc: byNum[String(f.id)] ?? NAME_FALLBACK[f.properties.name] ?? '',
            },
          }))
          .filter((f) => f.properties.name !== 'Antarctica'),
      )
    })
  }, [ref.countries])

  const material = useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color(c['globe-ocean']),
        emissive: new Color(c['globe-ocean']),
        emissiveIntensity: c.dark ? 0.35 : 0.75,
        shininess: 6,
      }),
    [c],
  )

  const maxDays = useMemo(() => Math.max(1, ...[...cStats.values()].map((s) => s.days)), [cStats])

  // ---- Arcs: one per route, highlighted by the selection ----
  const arcs = useMemo<ArcDatum[]>(() => {
    const sel = selection
    const selFlight =
      sel?.type === 'flight'
        ? (d.fd.flights.find((f) => f.id === sel.id) ?? d.fd.upcoming.find((f) => f.id === sel.id))
        : undefined
    const tripFlights = sel?.type === 'trip' ? new Set(d.cross.tripFlights.get(sel.id) ?? []) : null
    const m = new Map<string, ArcDatum>()
    const all =
      sel?.type === 'flight' && selFlight && !fd.flights.includes(selFlight)
        ? [...fd.flights, selFlight]
        : fd.flights
    for (const f of all) {
      const a = ref.airports[f.from]
      const b = ref.airports[f.to]
      if (!a || !b) continue
      const k = routeKey(f)
      const hot =
        (selFlight && routeKey(selFlight) === k) ||
        (sel?.type === 'route' && [sel.from, sel.to].sort().join('–') === k) ||
        (sel?.type === 'airport' && (f.from === sel.code || f.to === sel.code)) ||
        (tripFlights?.has(f.id) ?? false)
      const cur = m.get(k)
      if (cur) {
        cur.count++
        cur.hot ||= !!hot
      } else {
        m.set(k, {
          key: k,
          from: f.from,
          to: f.to,
          startLat: a.lat,
          startLng: a.lon,
          endLat: b.lat,
          endLng: b.lon,
          count: 1,
          km: f.distanceKm,
          hot: !!hot,
        })
      }
    }
    return [...m.values()]
  }, [fd.flights, ref.airports, selection, d.cross.tripFlights, d.fd.flights, d.fd.upcoming])
  const anyHot = arcs.some((a) => a.hot)

  // ---- City points ----
  const points = useMemo<PointDatum[]>(() => {
    if (!tl) return []
    return cities.slice(0, 600).map((s) => {
      const ci = tl.cities[s.idx]
      return { lat: ci.lat, lng: ci.lon, name: ci.name, days: s.days, idx: s.idx }
    })
  }, [cities, tl])

  // ---- Trip path ----
  const paths = useMemo(() => {
    if (selection?.type !== 'trip' || !tl) return []
    const trip = tl.trips[selection.id]
    if (!trip) return []
    const coords: [number, number][] = []
    for (const v of tl.visits) {
      const day = localDate(v.s, v.off)
      if (day < trip.start || day > trip.end) continue
      const p = tl.places[v.p]
      const last = coords[coords.length - 1]
      if (!last || haversineKm(last[0], last[1], p.lat, p.lon) > 2) coords.push([p.lat, p.lon])
    }
    return coords.length > 1 ? [{ coords }] : []
  }, [selection, tl])

  // ---- Rings & labels for the focused place ----
  const focus = useMemo(() => {
    const s = selection
    if (!s) return null
    if (s.type === 'city' && tl) {
      const ci = tl.cities[s.idx]
      return { lat: ci.lat, lng: ci.lon, alt: 0.55, label: ci.name }
    }
    if (s.type === 'point') return { lat: s.lat, lng: s.lon, alt: 0.6, label: s.label }
    if (s.type === 'airport') {
      const a = ref.airports[s.code]
      return a ? { lat: a.lat, lng: a.lon, alt: 0.8, label: s.code } : null
    }
    if (s.type === 'country') {
      const ci = ref.countries[s.cc]
      return ci
        ? { lat: ci.lat, lng: ci.lon, alt: altitudeForSpan(Math.sqrt(ci.area) * 1.8), label: '' }
        : null
    }
    if (s.type === 'flight' || s.type === 'route') {
      const f =
        s.type === 'flight'
          ? [...fd.flights, ...fd.upcoming].find((x) => x.id === s.id)
          : { from: s.from, to: s.to }
      if (!f) return null
      const a = ref.airports[f.from]
      const b = ref.airports[f.to]
      if (!a || !b) return null
      const mid = midpoint(a.lat, a.lon, b.lat, b.lon)
      return {
        lat: mid.lat,
        lng: mid.lon,
        alt: altitudeForSpan(haversineKm(a.lat, a.lon, b.lat, b.lon) * 1.3),
        label: '',
      }
    }
    if (s.type === 'trip' && tl) {
      const trip = tl.trips[s.id]
      if (!trip) return null
      const pts = trip.cities.map((i) => ({ lat: tl.cities[i].lat, lon: tl.cities[i].lon }))
      if (!pts.length) return null
      const cen = centroid(pts)
      const span =
        Math.max(300, ...pts.map((p) => haversineKm(cen.lat, cen.lon, p.lat, p.lon))) * 2.6
      return { lat: cen.lat, lng: cen.lon, alt: altitudeForSpan(span), label: '' }
    }
    return null
  }, [selection, tl, ref, fd.flights, fd.upcoming])

  // ---- Camera ----
  useEffect(() => {
    const g = globe.current
    if (!g) return
    const controls = g.controls()
    controls.autoRotate = !focus
    controls.autoRotateSpeed = 0.35
    if (focus) {
      g.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: focus.alt }, 1400)
    } else if (points.length) {
      const top = points.slice(0, 30).map((p) => ({ lat: p.lat, lon: p.lng }))
      const cen = centroid(top)
      g.pointOfView({ lat: cen.lat, lng: cen.lon, altitude: 2.3 }, 1400)
    }
  }, [focus, points, size.w])

  const hotCountries = useMemo(() => {
    const s = new Set<string>()
    if (selection?.type === 'country') s.add(selection.cc)
    if (country) s.add(country)
    if (selection?.type === 'trip' && tl) tl.trips[selection.id]?.countries.forEach((x) => s.add(x))
    return s
  }, [selection, country, tl])

  const tip = (html: string) => tooltip(c.surface, c.text, c.border, html)

  return (
    <div ref={wrap} className="absolute inset-0">
      {size.w > 0 && (
        <Globe
          ref={globe}
          onZoom={(pov) => {
            const a = Math.round(pov.altitude * 20) / 20
            setAlt((prev) => (Math.abs(prev - a) > 0.04 ? a : prev))
          }}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          showAtmosphere
          atmosphereColor={c.accent}
          atmosphereAltitude={0.14}
          // Countries
          polygonsData={features}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(f) => {
            const cc = (f as CountryFeature).properties.cc
            const days = cStats.get(cc)?.days ?? 0
            const visited = cStats.has(cc)
            if (hotCountries.has(cc)) return rgba(c.s2, 0.6)
            if (hoverCc === cc) return rgba(c.accent, visited ? 0.95 : 0.35)
            if (visited) return rgba(c.accent, 0.35 + 0.55 * Math.sqrt(Math.max(days, 1) / maxDays))
            return c['globe-land']
          }}
          polygonSideColor={() => rgba(c.accent, 0.12)}
          polygonStrokeColor={() => rgba(c.text, c.dark ? 0.18 : 0.14)}
          polygonAltitude={(f) => {
            const cc = (f as CountryFeature).properties.cc
            return hotCountries.has(cc) ? 0.01 : cStats.has(cc) ? 0.006 : 0.003
          }}
          polygonsTransitionDuration={300}
          polygonLabel={(f) => {
            const { cc, name } = (f as CountryFeature).properties
            const s = cStats.get(cc)
            const flag = ref.countries[cc]?.flag ?? ''
            return tip(
              `<b>${flag} ${name}</b>${s ? `<br/>${s.days ? plural(s.days, 'day') : 'Visited by air'}${s.cities.size ? ` · ${plural(s.cities.size, 'city', 'cities')}` : ''}` : '<br/><span style="opacity:.6">Not visited yet</span>'}`,
            )
          }}
          onPolygonHover={(f) => setHoverCc(f ? (f as CountryFeature).properties.cc : null)}
          onPolygonClick={(f) => {
            const cc = (f as CountryFeature).properties.cc
            if (cc && cStats.has(cc)) setCountry(country === cc ? null : cc)
          }}
          // Flights
          arcsData={arcs}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor={(a: object) => {
            const x = a as ArcDatum
            if (x.hot) return [c.s2, c.s4]
            return anyHot
              ? [rgba(c.text, 0.12), rgba(c.text, 0.12)]
              : [rgba(c.s2, 0.75), rgba(c.s1, 0.75)]
          }}
          arcStroke={(a) =>
            k * ((a as ArcDatum).hot ? 0.9 : Math.min(0.7, 0.25 + (a as ArcDatum).count * 0.06))
          }
          arcAltitudeAutoScale={0.38}
          arcDashLength={(a) => ((a as ArcDatum).hot ? 0.4 : 1)}
          arcDashGap={(a) => ((a as ArcDatum).hot ? 0.15 : 0)}
          arcDashAnimateTime={(a) => ((a as ArcDatum).hot ? 1600 : 0)}
          arcsTransitionDuration={0}
          arcLabel={(a) => {
            const x = a as ArcDatum
            return tip(
              `<b>${x.from} ⇄ ${x.to}</b><br/>${ref.airports[x.from]?.city} – ${ref.airports[x.to]?.city}<br/>${fmtKm(x.km)} · ${plural(x.count, 'flight')}`,
            )
          }}
          onArcClick={(a) =>
            select({ type: 'route', from: (a as ArcDatum).from, to: (a as ArcDatum).to })
          }
          // Cities
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => (c.dark ? '#ffffff' : c.s7)}
          pointAltitude={0.014}
          pointRadius={(p) =>
            k * Math.min(0.55, 0.12 + Math.log10((p as PointDatum).days + 1) * 0.16)
          }
          pointsMerge={false}
          pointLabel={(p) =>
            tip(`<b>${(p as PointDatum).name}</b><br/>${plural((p as PointDatum).days, 'day')}`)
          }
          onPointClick={(p) => select({ type: 'city', idx: (p as PointDatum).idx })}
          // Trip path
          pathsData={paths}
          pathPoints="coords"
          pathPointLat={(p) => (p as [number, number])[0]}
          pathPointLng={(p) => (p as [number, number])[1]}
          pathColor={() => [c.text, c.s4]}
          pathStroke={Math.max(0.6, 2 * k)}
          pathDashLength={0.9}
          pathDashGap={0.1}
          pathDashAnimateTime={12000}
          pathPointAlt={0.02}
          // Focus ring
          ringsData={focus?.label ? [focus] : []}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => (t: number) => rgba(c.s2, 1 - t)}
          ringMaxRadius={2.5 * k}
          ringPropagationSpeed={2}
          ringRepeatPeriod={900}
          labelsData={focus?.label ? [focus] : []}
          labelLat="lat"
          labelLng="lng"
          labelText="label"
          labelSize={0.9 * Math.max(k, 0.15)}
          labelDotRadius={0.25 * k}
          labelColor={() => c.text}
          labelAltitude={0.02}
          labelResolution={2}
        />
      )}
    </div>
  )
}
