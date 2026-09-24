/**
 * Renders the GitHub social preview card (1280×640) to .github/social-preview.png.
 *
 * The card is plain HTML + SVG: an orthographic globe drawn from the same Natural Earth data
 * the app uses, great-circle flight arcs, and one of the app's own livery-free aircraft
 * profiles. It is screenshotted with the locally installed Google Chrome via Playwright, so no
 * browser download is needed.
 *
 * Usage: npm run social-preview
 */
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson'
import { chromium } from 'playwright'
import { Globe2 } from 'lucide-react'
import { AircraftProfile } from '../src/components/AircraftProfile.tsx'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '.github', 'social-preview.png')

// ---------- Orthographic globe ----------
const W = 1280
const H = 640
const R = 330 // globe radius (px)
const CX = 930
const CY = 350
const VIEW_LON = -25 // centre of view: mid-Atlantic, so Europe, Africa and the Americas show
const VIEW_LAT = 28
const rad = Math.PI / 180
const [l0, p0] = [VIEW_LON * rad, VIEW_LAT * rad]

/** Projects lon/lat onto the globe; hidden points are pushed onto the limb. */
function project(lon: number, lat: number, alt = 0): { x: number; y: number; visible: boolean } {
  const [l, p] = [lon * rad, lat * rad]
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0)
  let x = Math.cos(p) * Math.sin(l - l0)
  let y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0)
  const visible = cosc >= 0
  if (!visible) {
    // Collapse the far side onto the horizon so filled shapes stay closed.
    const n = Math.hypot(x, y) || 1
    x /= n
    y /= n
  }
  const r = R * (1 + alt)
  return { x: CX + r * x, y: CY - r * y, visible }
}

const topo = JSON.parse(
  readFileSync(join(root, 'public/data/countries-110m.json'), 'utf8'),
) as Topology
const countries = (
  feature(topo, topo.objects.countries as GeometryCollection) as unknown as {
    features: Feature<Polygon | MultiPolygon>[]
  }
).features

const ring = (coords: Position[]) => {
  const pts = coords.map(([lon, lat]) => project(lon, lat))
  if (!pts.some((p) => p.visible)) return ''
  return `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}Z`
}
const VISITED = new Set(['PRT', 'ESP', 'FRA', 'GBR', 'ITA', 'DEU', 'USA', 'BRA', 'MAR', 'NLD'])
const NAME_TO_A3: Record<string, string> = {
  Portugal: 'PRT',
  Spain: 'ESP',
  France: 'FRA',
  'United Kingdom': 'GBR',
  Italy: 'ITA',
  Germany: 'DEU',
  'United States of America': 'USA',
  Brazil: 'BRA',
  Morocco: 'MAR',
  Netherlands: 'NLD',
}
let land = ''
let visited = ''
for (const f of countries) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  const d = polys.map((rings) => rings.map(ring).join('')).join('')
  if (!d) continue
  const a3 = NAME_TO_A3[(f.properties as { name?: string } | null)?.name ?? '']
  if (a3 && VISITED.has(a3)) visited += d
  else land += d
}

// ---------- Flight arcs (great circles, lifted above the surface) ----------
const CITY: Record<string, [number, number]> = {
  LIS: [-9.14, 38.72],
  JFK: [-73.78, 40.64],
  GRU: [-46.47, -23.43],
  LHR: [-0.45, 51.47],
  CDG: [2.55, 49.01],
  FCO: [12.25, 41.8],
  RAK: [-8.0, 31.6],
  BOS: [-71.0, 42.36],
  MAD: [-3.57, 40.47],
  AMS: [4.76, 52.31],
}
const ROUTES: [string, string][] = [
  ['LIS', 'JFK'],
  ['LIS', 'GRU'],
  ['LIS', 'LHR'],
  ['LIS', 'FCO'],
  ['MAD', 'BOS'],
  ['LIS', 'RAK'],
  ['CDG', 'LIS'],
  ['AMS', 'LIS'],
]
function arc(a: [number, number], b: [number, number]) {
  const toVec = ([lon, lat]: [number, number]) => [
    Math.cos(lat * rad) * Math.cos(lon * rad),
    Math.cos(lat * rad) * Math.sin(lon * rad),
    Math.sin(lat * rad),
  ]
  const [va, vb] = [toVec(a), toVec(b)]
  const omega = Math.acos(
    Math.min(
      1,
      va.reduce((s, v, i) => s + v * vb[i], 0),
    ),
  )
  const pts: string[] = []
  const N = 64
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega)
    const s2 = Math.sin(t * omega) / Math.sin(omega)
    const v = va.map((x, k) => s1 * x + s2 * vb[k])
    const lon = Math.atan2(v[1], v[0]) / rad
    const lat = Math.asin(v[2] / Math.hypot(...v)) / rad
    const p = project(lon, lat, Math.sin(t * Math.PI) * 0.12 * (omega / 1.2))
    if (p.visible) pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
  return pts.length > 1 ? `M${pts.join('L')}` : ''
}
const arcs = ROUTES.map(([a, b]) => arc(CITY[a], CITY[b])).filter(Boolean)
const dots = Object.values(CITY)
  .map(([lon, lat]) => project(lon, lat))
  .filter((p) => p.visible)

// ---------- Aircraft profile (the app's own component) ----------
const logo = renderToStaticMarkup(createElement(Globe2, { strokeWidth: 2 }))
const plane = renderToStaticMarkup(
  createElement(AircraftProfile, { name: 'Airbus A350-900', className: 'plane' }),
)

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  :root {
    --plane-body: #ffffff; --plane-shade: #dde1e7; --plane-line: #737a84;
    --plane-window: #3d4450; --plane-stroke: 2.5px;
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: ${W}px; height: ${H}px; overflow: hidden; color: #fff;
    font-family: -apple-system, 'SF Pro Display', 'Inter', 'Segoe UI', Roboto, sans-serif;
    background: radial-gradient(1200px 700px at 78% 55%, #16243a 0%, #0f0f0e 62%);
    -webkit-font-smoothing: antialiased;
  }
  svg.globe { position: absolute; inset: 0; }
  .copy { position: absolute; left: 80px; top: 118px; width: 560px; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand svg { width: 64px; height: 64px; color: #3987e5; }
  h1 { font-size: 76px; font-weight: 700; letter-spacing: -2px; }
  p.tag { margin-top: 26px; font-size: 30px; line-height: 1.3; color: #c3c2b7; }
  .chips { margin-top: 38px; display: flex; flex-wrap: wrap; gap: 12px; }
  .chip {
    font-size: 21px; padding: 9px 18px; border-radius: 999px;
    background: rgba(57,135,229,.14); color: #cde2fb; border: 1px solid rgba(57,135,229,.35);
  }
  .plane { position: absolute; left: 290px; top: 480px; width: 300px; height: 100px; }
</style></head><body>
<svg class="globe" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="ocean" cx="42%" cy="38%" r="75%">
      <stop offset="0" stop-color="#172538"/><stop offset="1" stop-color="#0b131f"/>
    </radialGradient>
    <radialGradient id="glow" r="50%">
      <stop offset=".78" stop-color="#3987e5" stop-opacity=".28"/>
      <stop offset="1" stop-color="#3987e5" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="arc" x1="0" x2="1">
      <stop offset="0" stop-color="#d95926"/><stop offset="1" stop-color="#3987e5"/>
    </linearGradient>
    <clipPath id="disc"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath>
  </defs>
  <circle cx="${CX}" cy="${CY}" r="${R * 1.16}" fill="url(#glow)"/>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#ocean)"/>
  <g clip-path="url(#disc)">
    <path d="${land}" fill="#2b2f36" stroke="#3a3f47" stroke-width="0.8" fill-rule="evenodd"/>
    <path d="${visited}" fill="#3987e5" stroke="#6aa5ee" stroke-width="0.8" fill-rule="evenodd"/>
  </g>
  ${arcs.map((d) => `<path d="${d}" fill="none" stroke="url(#arc)" stroke-width="2.6" stroke-linecap="round" opacity=".95"/>`).join('')}
  ${dots.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#fff"/>`).join('')}
</svg>
<div class="copy">
  <div class="brand">
    ${logo}
    <h1>Travel Dash</h1>
  </div>
  <p class="tag">Your Google Maps Timeline and Flighty flights on an interactive 3D globe.</p>
  <div class="chips">
    <span class="chip">Countries &amp; cities</span>
    <span class="chip">Flights &amp; aircraft</span>
    <span class="chip">Trips</span>
    <span class="chip">Runs in your browser</span>
  </div>
</div>
${plane}
</body></html>`

mkdirSync(dirname(out), { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.setContent(html)
await page.screenshot({ path: out, type: 'png' })
await browser.close()
console.log(`Wrote ${out}`)
