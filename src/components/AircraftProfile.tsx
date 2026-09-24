import { memo, useMemo } from 'react'
import { aircraftSpec } from '../lib/aircraft'
import { profileShapes } from '../lib/aircraftProfile'

/**
 * Stroke every shape, then fill them all on top: the parts merge into one silhouette with a
 * crisp outer outline and no seams where they overlap.
 */
function Layer({ paths, fill }: { paths: string[]; fill: string }) {
  if (!paths.length) return null
  return (
    <g>
      {paths.map((d, i) => (
        <path
          key={`o${i}`}
          d={d}
          fill="var(--plane-line)"
          stroke="var(--plane-line)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {paths.map((d, i) => (
        <path key={`f${i}`} d={d} fill={fill} />
      ))}
    </g>
  )
}

/** A livery-free side profile of an aircraft type, drawn from its real proportions. */
export const AircraftProfile = memo(function AircraftProfile({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const p = useMemo(() => profileShapes(aircraftSpec(name)), [name])
  return (
    <svg
      viewBox={p.viewBox.join(' ')}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
    >
      <Layer paths={p.body} fill="var(--plane-body)" />
      {p.windows.map(([x1, x2, y], i) => (
        <line
          key={i}
          x1={x1}
          x2={x2}
          y1={y}
          y2={y}
          stroke="var(--plane-window)"
          strokeWidth={0.26}
          strokeDasharray="0.26 0.3"
          opacity={0.75}
        />
      ))}
      <path d={p.cockpit} fill="var(--plane-window)" />
      <Layer paths={p.wing} fill="var(--plane-shade)" />
      {p.engines.map((e, i) => (
        <g key={i}>
          <Layer paths={e.parts} fill="var(--plane-shade)" />
          {e.intake && <path d={e.intake} fill="var(--plane-window)" />}
        </g>
      ))}
      {p.props.map((d, i) => (
        <path key={i} d={d} fill="var(--plane-line)" opacity={0.35} />
      ))}
    </svg>
  )
})
