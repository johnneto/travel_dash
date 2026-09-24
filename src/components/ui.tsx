import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('rounded-2xl border border-line bg-surface p-4 sm:p-5', className)}>
      {(title || action) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  /** Optional icon shown in a chip before the label. */
  icon?: LucideIcon
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={clsx(
        '@container rounded-2xl border border-line bg-surface p-4 text-left',
        onClick &&
          'transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
        {Icon && (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        {label}
      </div>
      {/* Wraps rather than truncates; steps down a size in narrow tiles. */}
      <div className="tabular mt-1 text-xl font-semibold tracking-tight break-words text-ink @[11rem]:text-2xl">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-pretty text-ink-2">{hint}</div>}
    </Tag>
  )
}

export interface BarItem {
  key: string
  label: ReactNode
  value: number
  display?: ReactNode
  onClick?: () => void
  active?: boolean
}

/** Horizontal ranked bars — the most legible form for top-N lists. */
export function BarList({
  items,
  max,
  limit = 8,
  color = 'var(--s1)',
}: {
  items: BarItem[]
  max?: number
  limit?: number
  color?: string
}) {
  const shown = items.slice(0, limit)
  const top = max ?? Math.max(1, ...shown.map((i) => i.value))
  if (!shown.length) return <Empty>No data for this selection.</Empty>
  return (
    <ul className="space-y-1.5">
      {shown.map((it) => {
        const Row = it.onClick ? 'button' : 'div'
        return (
          <li key={it.key}>
            <Row
              onClick={it.onClick}
              title={typeof it.label === 'string' ? `${it.label}: ${it.value}` : undefined}
              className={clsx(
                'group relative flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm',
                it.onClick && 'hover:bg-surface-2',
                it.active && 'bg-surface-2 ring-1 ring-accent',
              )}
            >
              <span className="relative z-10 min-w-0 flex-1 truncate text-ink">{it.label}</span>
              <span className="tabular relative z-10 shrink-0 text-xs font-medium text-ink-2">
                {it.display ?? it.value}
              </span>
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 rounded-r-[4px] opacity-20 transition-all group-hover:opacity-30"
                style={{ width: `${Math.max(2, (it.value / top) * 100)}%`, background: color }}
              />
            </Row>
          </li>
        )
      })}
    </ul>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-3">{children}</p>
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'good' | 'bad' | 'accent'
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-2 text-ink-2',
        tone === 'good' && 'bg-good/15 text-good',
        tone === 'bad' && 'bg-bad/15 text-bad',
        tone === 'accent' && 'bg-accent/15 text-accent',
      )}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Grid({
  children,
  cols = 'sm:grid-cols-2',
}: {
  children: ReactNode
  cols?: string
}) {
  return <div className={clsx('grid grid-cols-1 gap-3 sm:gap-4', cols)}>{children}</div>
}
