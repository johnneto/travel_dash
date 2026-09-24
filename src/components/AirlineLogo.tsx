import { memo, useState } from 'react'

/**
 * An airline's logo from the public Aviasales logo CDN, looked up by IATA code. Falls back to
 * a badge with the code when there's no IATA code or the image fails to load. Only the airline
 * code is sent; no referrer.
 */
export const AirlineLogo = memo(function AirlineLogo({
  iata,
  fallback,
  size = 20,
}: {
  iata: string | null
  /** Shown in the badge when there's no logo (e.g. the ICAO code). */
  fallback: string
  /** Rendered width and height in px. */
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const box = 'inline-block shrink-0 rounded align-middle'
  const dims = { width: size, height: size }
  if (!iata || failed) {
    return (
      <span
        aria-hidden
        style={{ ...dims, lineHeight: `${size}px`, fontSize: Math.round(size * 0.45) }}
        className={`${box} bg-surface-2 text-center font-semibold text-ink-3`}
      >
        {(iata ?? fallback).slice(0, 3)}
      </span>
    )
  }
  return (
    <img
      src={`https://pics.avs.io/al_square/64/64/${encodeURIComponent(iata)}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={dims}
      className={`${box} bg-white object-contain`}
    />
  )
})
