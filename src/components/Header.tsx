import { Globe2, Monitor, Moon, Sun, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore, type Theme } from '../store/useStore'
import { discoveryCurve } from '../lib/stats'

const selectCls =
  'h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus:border-accent focus:outline-none'

export function Header() {
  const setImportOpen = useStore((s) => s.setImportOpen)
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="mr-auto flex items-center gap-2">
          <Globe2 className="h-6 w-6 text-accent" aria-hidden />
          <h1 className="text-base font-semibold tracking-tight">Travel Dash</h1>
        </div>
        <div className="order-3 flex w-full flex-wrap items-center gap-2 sm:order-none sm:w-auto">
          <PeriodPicker />
          <CountryPicker />
        </div>
        <ThemeToggle />
        <button
          onClick={() => setImportOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white hover:opacity-90"
        >
          <Upload className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Import</span>
        </button>
      </div>
    </header>
  )
}

function PeriodPicker() {
  const data = useStore((s) => s.data)
  const range = useStore((s) => s.range)
  const setRange = useStore((s) => s.setRange)
  const [custom, setCustom] = useState(false)

  const years = useMemo(() => {
    const ys = new Set<string>()
    data.flights.forEach((f) => ys.add(f.date.slice(0, 4)))
    data.timeline?.days.forEach((d) => ys.add(d.d.slice(0, 4)))
    return [...ys].sort().reverse()
  }, [data])

  const today = new Date().toISOString().slice(0, 10)
  const last12 = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
  const value = custom
    ? 'custom'
    : !range.from && !range.to
      ? 'all'
      : range.from === last12 && range.to === today
        ? 'last12'
        : range.from?.endsWith('-01-01') && range.to === `${range.from.slice(0, 4)}-12-31`
          ? `y${range.from.slice(0, 4)}`
          : 'custom'

  const onChange = (v: string) => {
    setCustom(v === 'custom')
    if (v === 'all') setRange({ from: null, to: null })
    else if (v === 'last12') setRange({ from: last12, to: today })
    else if (v.startsWith('y')) setRange({ from: `${v.slice(1)}-01-01`, to: `${v.slice(1)}-12-31` })
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="period">
        Time period
      </label>
      <select
        id="period"
        className={selectCls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All time</option>
        <option value="last12">Last 12 months</option>
        {years.map((y) => (
          <option key={y} value={`y${y}`}>
            {y}
          </option>
        ))}
        <option value="custom">Custom range…</option>
      </select>
      {value === 'custom' && (
        <div className="flex items-center gap-1">
          <input
            type="date"
            aria-label="From"
            className={selectCls}
            value={range.from ?? ''}
            onChange={(e) => setRange({ ...range, from: e.target.value || null })}
          />
          <span className="text-ink-3">–</span>
          <input
            type="date"
            aria-label="To"
            className={selectCls}
            value={range.to ?? ''}
            onChange={(e) => setRange({ ...range, to: e.target.value || null })}
          />
        </div>
      )}
    </div>
  )
}

function CountryPicker() {
  const data = useStore((s) => s.data)
  const ref = useStore((s) => s.ref)!
  const country = useStore((s) => s.country)
  const setCountry = useStore((s) => s.setCountry)
  const options = useMemo(() => {
    const first = discoveryCurve(data.timeline, data.flights)
    return [...first.keys()]
      .filter((cc) => ref.countries[cc])
      .sort((a, b) => ref.countries[a].name.localeCompare(ref.countries[b].name))
  }, [data, ref])
  return (
    <div className="flex items-center gap-1">
      <label className="sr-only" htmlFor="country">
        Country
      </label>
      <select
        id="country"
        className={`${selectCls} max-w-[12rem]`}
        value={country ?? ''}
        onChange={(e) => setCountry(e.target.value || null)}
      >
        <option value="">All countries</option>
        {options.map((cc) => (
          <option key={cc} value={cc}>
            {ref.countries[cc].flag} {ref.countries[cc].name}
          </option>
        ))}
      </select>
      {country && (
        <button
          onClick={() => setCountry(null)}
          aria-label="Clear country filter"
          className="grid h-9 w-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function ThemeToggle() {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const opts: { v: Theme; icon: typeof Sun; label: string }[] = [
    { v: 'light', icon: Sun, label: 'Light' },
    { v: 'system', icon: Monitor, label: 'System' },
    { v: 'dark', icon: Moon, label: 'Dark' },
  ]
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg bg-surface-2 p-0.5">
      {opts.map(({ v, icon: Icon, label }) => (
        <button
          key={v}
          role="radio"
          aria-checked={theme === v}
          title={label}
          onClick={() => setTheme(v)}
          className={`grid h-8 w-8 place-items-center rounded-md transition ${
            theme === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
