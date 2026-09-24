import type { AircraftSpec } from './aircraft'

type Pt = [number, number]

/** SVG path layers for a side profile, back to front. Units are metres, nose pointing right. */
export interface ProfileShapes {
  viewBox: [number, number, number, number]
  /** Fuselage, fin and tailplane — outlined as one silhouette. */
  body: string[]
  wing: string[]
  /** Each engine (nacelle + pylon) is outlined on its own, with its dark intake. */
  engines: { parts: string[]; intake?: string }[]
  /** Propeller discs. */
  props: string[]
  /** Window rows as [x1, x2, y] lines. */
  windows: [number, number, number][]
  cockpit: string
}

const f = (n: number) => Math.round(n * 100) / 100

class Builder {
  minX = Infinity
  minY = Infinity
  maxX = -Infinity
  maxY = -Infinity
  add(...pts: Pt[]) {
    for (const [x, y] of pts) {
      this.minX = Math.min(this.minX, x)
      this.maxX = Math.max(this.maxX, x)
      this.minY = Math.min(this.minY, y)
      this.maxY = Math.max(this.maxY, y)
    }
  }
  poly(pts: Pt[]) {
    this.add(...pts)
    return `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join('L')}Z`
  }
  /** A path from absolute commands: ['M', p] | ['L', p] | ['C', c1, c2, p] | ['Q', c, p]. */
  path(cmds: [string, ...Pt[]][]) {
    let d = ''
    for (const [op, ...pts] of cmds) {
      this.add(...pts)
      d += op + pts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')
    }
    return `${d}Z`
  }
}

const NOSE_LEN: Record<AircraftSpec['nose'], number> = {
  airbus: 1.55,
  boeing: 1.45,
  b787: 1.9,
  a350: 1.7,
  regional: 1.35,
}

export function profileShapes(s: AircraftSpec): ProfileShapes {
  const b = new Builder()
  const L = s.length
  const D = s.diameter
  const R = D / 2
  const nL = (s.deck === 'double' ? 0.95 : NOSE_LEN[s.nose]) * D
  const xN = L - nL
  const xT = Math.min(0.25 * L, 2.4 * D)
  const hump = s.deck === 'hump'
  const humpY = -1.34 * R

  // ---- Fuselage ----
  const pointy = s.nose === 'boeing' || s.nose === 'b787'
  const tipY = pointy ? 0.22 * R : 0.12 * R
  const top: [string, ...Pt[]][] = [
    ['M', [0, -0.72 * R]],
    ['C', [xT * 0.3, -0.9 * R], [xT * 0.6, -R], [xT, -R]],
  ]
  if (hump) {
    top.push(
      ['L', [0.6 * L, -R]],
      ['C', [0.65 * L, -R], [0.67 * L, humpY], [0.73 * L, humpY]],
      ['L', [L - 1.1 * D, humpY]],
      ['C', [L - 0.35 * D, humpY], [L, -0.55 * R], [L, tipY]],
    )
  } else {
    const c1: Pt =
      s.nose === 'b787'
        ? [xN + 0.5 * nL, -R]
        : s.nose === 'boeing'
          ? [xN + 0.45 * nL, -R]
          : [xN + 0.6 * nL, -R]
    const c2: Pt =
      s.nose === 'b787'
        ? [L - 0.05 * nL, -0.2 * R]
        : s.nose === 'boeing'
          ? [L - 0.1 * nL, -0.45 * R]
          : [L, -0.62 * R]
    top.push(['L', [xN, -R]], ['C', c1, c2, [L, tipY]])
  }
  const bottomStart = hump ? L - 1.6 * D : xN
  const fuselage = b.path([
    ...top,
    ['C', [L - 0.01 * nL, 0.75 * R], [bottomStart + 0.5 * (L - bottomStart), R], [bottomStart, R]],
    ['L', [xT, R]],
    ['C', [xT * 0.55, R], [xT * 0.2, -0.1 * R], [0, -0.42 * R]],
  ])

  // ---- Tail ----
  const body = [fuselage]
  const tee = s.tail === 'T'
  const H = D * (s.deck === 'double' ? 1.15 : tee ? 1.15 : 1.3)
  const tailEngine = s.engines === 'tail3'
  const eD = s.engineScale * D
  const finBase = tailEngine ? -R - eD * 0.95 : -0.8 * R
  const rootLE = tailEngine ? 0.19 * L : Math.min(xT * 0.95, 0.26 * L)
  const rootTE = 0.03 * L
  const chord = rootLE - rootTE
  const topY = (tailEngine ? finBase : -R) - H
  const topLE = rootLE - (tee ? 1.0 : 0.84) * (finBase - topY)
  const topTE = topLE - (tee ? 0.6 : 0.45) * chord
  body.push(
    b.poly([
      [rootLE + 0.08 * chord, finBase + 0.1 * R],
      [rootLE, finBase],
      [topLE, topY],
      [topTE, topY],
      [rootTE, finBase],
      [rootTE, finBase + 0.3 * R],
    ]),
  )
  if (tee) {
    const c = topLE - topTE
    body.push(
      b.poly([
        [topLE + 0.25 * c, topY + 0.12 * R],
        [topTE - 0.35 * c, topY - 0.28 * R],
        [topTE - 0.6 * c, topY - 0.2 * R],
        [topTE - 0.1 * c, topY + 0.3 * R],
      ]),
    )
  } else {
    const sx = rootLE * 0.95
    body.push(
      b.poly([
        [sx, -0.12 * R],
        [sx - 0.12 * L, -0.58 * R],
        [sx - 0.15 * L, -0.52 * R],
        [sx - 0.06 * L, 0.02 * R],
      ]),
    )
  }
  let tailNacelle: ProfileShapes['engines'][number] | null = null
  if (tailEngine) {
    // Centre engine at the base of the fin (MD-11, DC-10).
    const yc = -R - eD * 0.45
    const xf = 0.24 * L
    const xb = 0.02 * L
    tailNacelle = {
      parts: [
        b.path([
          ['M', [xf, yc - eD / 2]],
          ['L', [xb, yc - eD * 0.4]],
          ['L', [xb, yc + eD * 0.4]],
          ['L', [xf - 0.03 * L, -0.85 * R]],
          ['L', [xf, yc + eD / 2]],
          ['Q', [xf + 0.1 * eD, yc], [xf, yc - eD / 2]],
        ]),
      ],
      intake: ellipse(b, xf - 0.02 * eD, yc, 0.07 * eD, eD / 2),
    }
  }

  // ---- Wing ----
  const high = s.wing === 'high'
  const wide = D > 5
  const xr = L * (s.engines === 'tail2' ? 0.5 : high ? 0.56 : 0.6)
  const c = L * (wide ? 0.16 : 0.17)
  const semi = 0.47 * L
  const tanS = s.engines === 'prop2' ? 0.05 : wide ? 0.6 : 0.47
  const dz = high ? -0.02 * semi : 0.06 * semi
  const yr = high ? -0.95 * R : 0.45 * R
  const ct = 0.3 * c
  const tx = xr - semi * tanS
  const ty = yr - dz
  const wing = [
    high
      ? b.poly([
          [xr, yr],
          [xr - 0.3 * c, yr - 0.22 * R],
          [tx - 0.3 * ct, ty - 0.12 * R],
          [tx - ct, ty],
          [xr - c, yr + 0.05 * R],
        ])
      : b.poly([
          [xr, yr],
          [tx, ty],
          [tx - ct, ty + 0.05 * R],
          [xr - c, yr + 0.18 * R],
          [xr - 0.35 * c, yr + 0.32 * R],
        ]),
  ]
  const wl = winglet(b, s.winglet, tx, ty, ct, wide ? 0.6 * R : 0.75 * R)
  wing.push(...wl)

  // ---- Engines ----
  const engines: ProfileShapes['engines'] = tailNacelle ? [tailNacelle] : []
  const props: string[] = []
  const localChord = (st: number) => c * (1 - 0.7 * st)
  const jet = (st: number, scale: number) => {
    const d = eD * scale
    const len = d * (s.engines === 'wing4' ? 2.3 : 1.9)
    const ex = xr - semi * st * tanS
    const ey = yr - dz * st
    const xf = ex + len * 0.55
    const xb = xf - len
    const yc = ey + d * 0.62
    const r = d / 2
    const lc = localChord(st)
    const parts = [
      b.poly([
        [xf - 0.3 * len, yc - 0.9 * r],
        [xb + 0.05 * len, yc - 0.8 * r],
        [ex - 0.75 * lc, ey + 0.05 * R],
        [ex - 0.1 * lc, ey],
      ]),
      b.path([
        ['M', [xf, yc - r]],
        ['L', [xb, yc - 0.8 * r]],
        ['L', [xb - 0.35 * d, yc]],
        ['L', [xb, yc + 0.72 * r]],
        ['L', [xf, yc + r]],
        ['Q', [xf + 0.12 * d, yc], [xf, yc - r]],
      ]),
    ]
    engines.push({ parts, intake: ellipse(b, xf - 0.02 * d, yc, 0.07 * d, r) })
  }
  if (s.engines === 'wing2' || s.engines === 'tail3') jet(0.33, 1)
  if (s.engines === 'wing4') {
    // The outer engine is nearer the viewer, so it's drawn over the inner one.
    jet(0.3, 1)
    jet(0.62, 0.95)
  }
  if (s.engines === 'tail2') {
    const len = eD * 3.2
    const xf = xT + 0.5 * len
    const xb = xf - len
    const yc = -0.35 * R
    const r = eD / 2
    const nacelle = b.path([
      ['M', [xf, yc - r]],
      ['L', [xb, yc - 0.8 * r]],
      ['L', [xb - 0.3 * eD, yc]],
      ['L', [xb, yc + 0.75 * r]],
      ['L', [xf, yc + r]],
      ['Q', [xf + 0.12 * eD, yc], [xf, yc - r]],
    ])
    engines.push({ parts: [nacelle], intake: ellipse(b, xf - 0.02 * eD, yc, 0.07 * eD, r) })
  }
  if (s.engines === 'prop2') {
    const st = 0.3
    const ex = xr - semi * st * tanS
    const ey = yr - dz * st
    const lc = localChord(st)
    const xf = ex + 0.45 * lc
    const xb = ex - 1.05 * lc
    const yc = ey + eD * 0.4
    const r = eD / 2
    const nacelle = b.path([
      ['M', [xf, yc - r]],
      ['L', [xb, yc - 0.2 * r]],
      ['L', [xb, yc + 0.5 * r]],
      ['L', [xf, yc + r]],
      ['L', [xf + 0.35 * eD, yc]],
    ])
    engines.push({ parts: [nacelle] })
    props.push(ellipse(b, xf + 0.08 * eD, yc, 0.06 * D, 0.75 * D))
  }

  // ---- Details ----
  const winY = -0.3 * R
  const windows: [number, number, number][] =
    s.deck === 'double'
      ? [
          [xT * 0.95, xN - 0.1 * D, -0.5 * R],
          [xT * 0.9, xN - 0.05 * D, 0.1 * R],
        ]
      : [[xT * 0.9, (hump ? L - 1.7 * D : xN) - 0.1 * D, winY]]
  if (hump) windows.push([0.7 * L, L - 1.3 * D, -1.13 * R])
  const cockpit = hump
    ? b.poly([
        [L - 1.2 * D, -1.2 * R],
        [L - 0.9 * D, -1.15 * R],
        [L - 0.88 * D, -0.98 * R],
        [L - 1.18 * D, -1.02 * R],
      ])
    : b.poly([
        [L - 0.48 * nL, -0.78 * R],
        [L - 0.2 * nL, -0.52 * R],
        [L - 0.17 * nL, -0.34 * R],
        [L - 0.45 * nL, -0.56 * R],
      ])

  const pad = 0.02 * L
  return {
    viewBox: [
      f(b.minX - pad),
      f(b.minY - pad),
      f(b.maxX - b.minX + 2 * pad),
      f(b.maxY - b.minY + 2 * pad),
    ],
    body,
    wing,
    engines,
    props,
    windows,
    cockpit,
  }
}

function ellipse(b: Builder, cx: number, cy: number, rx: number, ry: number) {
  b.add([cx - rx, cy - ry], [cx + rx, cy + ry])
  return `M${f(cx - rx)},${f(cy)}a${f(rx)},${f(ry)} 0 1,0 ${f(2 * rx)},0a${f(rx)},${f(ry)} 0 1,0 ${f(-2 * rx)},0Z`
}

/** Wingtip device seen from the side, drawn up (and sometimes down) from the tip. */
function winglet(
  b: Builder,
  kind: AircraftSpec['winglet'],
  tx: number,
  ty: number,
  ct: number,
  h: number,
): string[] {
  switch (kind) {
    case 'none':
      return []
    case 'fence':
      return [
        b.poly([
          [tx, ty],
          [tx - 0.6 * ct, ty - 0.3 * h],
          [tx - 0.9 * ct, ty - 0.28 * h],
          [tx - ct, ty + 0.02 * h],
          [tx - 0.7 * ct, ty + 0.2 * h],
          [tx - 0.4 * ct, ty + 0.18 * h],
        ]),
      ]
    case 'blended':
      return [
        b.poly([
          [tx, ty],
          [tx - 0.65 * ct, ty - 0.85 * h],
          [tx - 0.95 * ct, ty - 0.87 * h],
          [tx - 1.05 * ct, ty + 0.04 * h],
        ]),
      ]
    case 'split':
      return [
        b.poly([
          [tx, ty],
          [tx - 0.65 * ct, ty - 0.9 * h],
          [tx - 0.95 * ct, ty - 0.92 * h],
          [tx - 1.05 * ct, ty + 0.04 * h],
        ]),
        b.poly([
          [tx - 0.25 * ct, ty],
          [tx - 0.75 * ct, ty + 0.45 * h],
          [tx - 0.95 * ct, ty + 0.44 * h],
          [tx - 0.9 * ct, ty],
        ]),
      ]
    case 'sharklet':
    case 'curved':
      return [
        b.path([
          ['M', [tx, ty]],
          [
            'C',
            [tx - 0.15 * ct, ty - 0.35 * h],
            [tx - 0.45 * ct, ty - 0.85 * h],
            [tx - 0.8 * ct, ty - h],
          ],
          ['L', [tx - 1.0 * ct, ty - 0.97 * h]],
          ['L', [tx - 1.02 * ct, ty + 0.04 * h]],
        ]),
      ]
  }
}
