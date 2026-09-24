import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReactNode } from 'react'
import { useColors } from '../hooks/ThemeContext'
import { Empty } from './ui'
import { MONTHS } from '../lib/format'

const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 })
const tick = (v: number) => compact.format(v)

function TooltipBox({
  title,
  rows,
}: {
  title: ReactNode
  rows: { label: string; value: string; color?: string }[]
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="tabular font-medium text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  )
}

export function ColumnChart({
  data,
  valueLabel,
  format = (v) => String(v),
  height = 180,
  onBarClick,
}: {
  data: { label: string; value: number }[]
  valueLabel: string
  format?: (v: number) => string
  height?: number
  onBarClick?: (label: string) => void
}) {
  const c = useColors()
  if (!data.length) return <Empty>No data for this selection.</Empty>
  return (
    <div style={{ height }} role="img" aria-label={`${valueLabel} chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={tick}
            width={44}
          />
          <Tooltip
            cursor={{ fill: c['surface-2'] }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={label}
                  rows={[{ label: valueLabel, value: format(payload[0].value as number) }]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="value"
            fill={c.s1}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
            cursor={onBarClick ? 'pointer' : undefined}
            onClick={(d) => onBarClick?.((d as unknown as { label: string }).label)}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StackedColumns({
  data,
  keys,
  labels,
  format = (v) => String(Math.round(v)),
  height = 220,
}: {
  data: Record<string, number | string>[]
  keys: string[]
  labels: Record<string, string>
  format?: (v: number) => string
  height?: number
}) {
  const c = useColors()
  const palette = [c.s1, c.s2, c.s3, c.s4, c.s5, c.s6, c.s7, c.s8]
  if (!data.length) return <Empty>No data for this selection.</Empty>
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} tickFormatter={tick} width={44} />
          <Tooltip
            cursor={{ fill: c['surface-2'] }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={label}
                  rows={[...payload].reverse().map((p) => ({
                    label: labels[p.dataKey as string] ?? String(p.dataKey),
                    value: format(p.value as number),
                    color: p.color,
                  }))}
                />
              ) : null
            }
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span className="text-xs text-ink-2">{labels[v] ?? v}</span>}
          />
          {keys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              stackId="a"
              fill={palette[i % palette.length]}
              stroke={c.surface}
              strokeWidth={1}
              radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function StepArea({
  data,
  valueLabel,
  height = 180,
}: {
  data: { label: string; value: number; note?: string }[]
  valueLabel: string
  height?: number
}) {
  const c = useColors()
  if (data.length < 2) return <Empty>Not enough data to draw a trend.</Empty>
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.s1} stopOpacity={0.3} />
              <stop offset="100%" stopColor={c.s1} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={label}
                  rows={[
                    { label: valueLabel, value: String(payload[0].value) },
                    ...((payload[0].payload as { note?: string }).note
                      ? [{ label: 'New', value: (payload[0].payload as { note: string }).note }]
                      : []),
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="stepAfter"
            dataKey="value"
            stroke={c.s1}
            strokeWidth={2}
            fill="url(#areaFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Month × year grid, one sequential hue. */
export function Heatmap({
  cells,
  years,
  format = (v) => String(v),
  unit,
}: {
  cells: Map<string, number> // key YYYY-MM
  years: string[]
  format?: (v: number) => string
  unit: string
}) {
  const c = useColors()
  const max = Math.max(1, ...cells.values())
  if (!years.length) return <Empty>No data for this selection.</Empty>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[3px] text-[11px]">
        <thead>
          <tr>
            <th />
            {MONTHS.map((m) => (
              <th key={m} className="font-normal text-ink-3">
                {m[0]}
                <span className="hidden sm:inline">{m.slice(1)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <td className="tabular pr-1 text-right text-ink-3">{y}</td>
              {MONTHS.map((m, i) => {
                const k = `${y}-${String(i + 1).padStart(2, '0')}`
                const v = cells.get(k) ?? 0
                const t = v / max
                return (
                  <td
                    key={k}
                    title={`${m} ${y}: ${format(v)} ${unit}`}
                    className="h-5 min-w-4 rounded-[4px]"
                    style={{
                      background: v ? c.s1 : c['surface-2'],
                      opacity: v ? 0.18 + 0.82 * Math.sqrt(t) : 1,
                    }}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
