import clsx from 'clsx'
import type { SeatKind } from '../lib/insights'

const SEATS: SeatKind[] = ['window', 'middle', 'aisle']

/**
 * A three-seat row seen from the front — cabin wall and window on the left, aisle on the
 * right — with the preferred seat highlighted.
 */
export function SeatIcon({ seat, className }: { seat: SeatKind; className?: string }) {
  return (
    <svg viewBox="0 0 64 30" className={clsx('shrink-0', className)} aria-hidden>
      {/* Cabin wall with a window */}
      <path d="M0 0h6q-2 15 0 30H0z" fill="var(--plane-shade)" />
      <rect x={1.2} y={7} width={3} height={9} rx={1.5} fill="var(--accent-soft)" />
      {SEATS.map((kind, i) => {
        const x = 9 + i * 14
        const on = kind === seat
        const fill = on ? 'var(--accent)' : 'var(--surface-2)'
        const stroke = on ? 'var(--accent)' : 'var(--text-3)'
        return (
          <g key={kind} fill={fill} stroke={stroke} strokeWidth={1}>
            <rect x={x} y={4} width={12} height={17} rx={3} />
            <rect x={x - 1} y={20} width={14} height={5} rx={2} />
          </g>
        )
      })}
      {/* Aisle */}
      <path d="M57 2v26" stroke="var(--text-3)" strokeWidth={1} strokeDasharray="2 2" />
    </svg>
  )
}
