import { memo, useState } from 'react'

/**
 * An airline's logo from the public Aviasales logo CDN, looked up by IATA code. Falls back to
 * a badge with the code when there's no IATA code or the image fails to load. Only the airline
 * code is sent; no referrer.
 */
export const AirlineLogo = memo(function AirlineLogo({
  iata,
  fallback,
}: {
  iata: string | null
  /** Shown in the badge when there's no logo (e.g. the ICAO code). */
  fallback: string
}) {
  const [failed, setFailed] = useState(false)
  const box = 'inline-block h-5 w-5 shrink-0 rounded align-middle'
  if (!iata || failed) {
    return (
      <span
        aria-hidden
        className={`${box} bg-surface-2 text-center text-[9px] leading-5 font-semibold text-ink-3`}
      >
        {(iata ?? fallback).slice(0, 3)}
      </span>
    )
  }
  return (
    <img
      src={`https://pics.avs.io/al_square/64/64/${encodeURIComponent(iata)}.png`}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${box} bg-white object-contain`}
    />
  )
})
