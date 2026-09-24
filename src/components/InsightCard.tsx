import {
  Armchair,
  CalendarDays,
  Clock,
  Compass,
  Footprints,
  Globe2,
  Leaf,
  Map,
  Plane,
  Search,
  Sparkles,
  Trophy,
} from 'lucide-react'
import clsx from 'clsx'
import type { Insight, InsightKind } from '../lib/insights'
import { useStore } from '../store/useStore'

const ICONS: Record<InsightKind, typeof Globe2> = {
  globe: Globe2,
  plane: Plane,
  clock: Clock,
  map: Map,
  trophy: Trophy,
  walk: Footprints,
  calendar: CalendarDays,
  compass: Compass,
  sparkles: Sparkles,
  leaf: Leaf,
  search: Search,
  seat: Armchair,
}

export function InsightCard({ insight }: { insight: Insight }) {
  const select = useStore((s) => s.select)
  const setCountry = useStore((s) => s.setCountry)
  const Icon = ICONS[insight.kind]
  const clickable = !!insight.select
  const Tag = clickable ? 'button' : 'div'
  return (
    <Tag
      onClick={() => {
        const s = insight.select
        if (!s) return
        if (s.type === 'country') setCountry(s.cc)
        else select(s)
      }}
      className={clsx(
        'flex h-full flex-col rounded-2xl border border-line bg-surface p-4 text-left',
        clickable && 'transition hover:-translate-y-0.5 hover:border-accent',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-ink-3">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/12 text-accent">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        {insight.label}
      </div>
      <div className="mt-2 text-lg font-semibold leading-tight tracking-tight text-ink">
        {insight.value}
      </div>
      <p className="mt-1 text-[13px] leading-snug text-ink-2">{insight.text}</p>
      {clickable && (
        <span className="mt-auto pt-2 text-[11px] font-medium text-accent">Show on globe →</span>
      )}
    </Tag>
  )
}
