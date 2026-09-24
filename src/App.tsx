import { lazy, Suspense, useEffect } from 'react'
import clsx from 'clsx'
import { Loader2, Upload } from 'lucide-react'
import { hasAnyData, useStore, type Tab } from './store/useStore'
import { useApplyTheme } from './hooks/useTheme'
import { ThemeContext } from './hooks/ThemeContext'
import { useDerived } from './hooks/useDerived'
import { Header } from './components/Header'
import { ImportDialog } from './components/ImportDialog'
import { SelectionCard } from './components/SelectionCard'
import { Overview } from './sections/Overview'
import { Places } from './sections/Places'
import { Flights } from './sections/Flights'
import { Trips } from './sections/Trips'
import { Movement } from './sections/Movement'
import { fmtDate } from './lib/format'

const GlobeView = lazy(() => import('./components/GlobeView'))

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'places', label: 'Places' },
  { id: 'flights', label: 'Flights' },
  { id: 'trips', label: 'Trips' },
  { id: 'movement', label: 'Movement' },
]

export default function App() {
  const colors = useApplyTheme()
  const ready = useStore((s) => s.ready)
  const init = useStore((s) => s.init)
  useEffect(() => {
    init().catch((e) => console.error(e))
  }, [init])

  return (
    <ThemeContext.Provider value={colors}>
      {ready ? (
        <Dashboard />
      ) : (
        <div className="grid min-h-dvh place-items-center text-ink-3">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </ThemeContext.Provider>
  )
}

function Dashboard() {
  const d = useDerived()
  const tab = useStore((s) => s.tab)
  const setTab = useStore((s) => s.setTab)
  const range = useStore((s) => s.range)
  const country = useStore((s) => s.country)
  const data = useStore((s) => s.data)
  const setImportOpen = useStore((s) => s.setImportOpen)
  const profileId = useStore((s) => s.profileId)
  const hasData = hasAnyData(data)

  return (
    <div className="min-h-dvh">
      <Header />
      <ImportDialog />
      <main className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 px-4 pt-4 pb-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Globe */}
        <div className="relative h-[46dvh] min-h-[300px] overflow-hidden rounded-2xl border border-line bg-surface lg:sticky lg:top-[72px] lg:h-[calc(100dvh-92px)]">
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-ink-3">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            }
          >
            <GlobeView d={d} />
          </Suspense>
          <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-1.5 text-[11px] text-ink-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2 py-0.5 backdrop-blur">
              <span className="h-2 w-2 rounded-sm bg-accent" /> Visited countries
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/80 px-2 py-0.5 backdrop-blur">
              <span
                className="h-0.5 w-3 rounded"
                style={{ background: 'linear-gradient(90deg, var(--s2), var(--s1))' }}
              />{' '}
              Flights
            </span>
            {(range.from || range.to || country) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 font-medium text-white">
                {country
                  ? `${d.ref.countries[country]?.flag} ${d.ref.countries[country]?.name}`
                  : ''}
                {country && (range.from || range.to) ? ' · ' : ''}
                {range.from || range.to
                  ? `${fmtDate(range.from) ?? '…'} – ${range.to ? fmtDate(range.to) : 'now'}`
                  : ''}
              </span>
            )}
          </div>
          <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex justify-start">
            <SelectionCard d={d} />
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0">
          <nav
            aria-label="Sections"
            className="sticky top-[57px] z-20 -mx-4 mb-4 overflow-x-auto bg-bg/85 px-4 py-2 backdrop-blur sm:top-[57px] lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
          >
            <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition',
                    tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
          {!hasData ? (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center">
              <p className="text-sm text-ink-2">
                No data in this profile yet. Import a Flighty CSV, a Google Timeline JSON, or both
                to get started.
              </p>
              <button
                onClick={() => setImportOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
              >
                <Upload className="h-4 w-4" /> Import files
              </button>
            </div>
          ) : (
            // Keyed by profile so section-local state (metric toggles, search) resets on switch.
            <div key={profileId}>
              {tab === 'overview' && <Overview d={d} />}
              {tab === 'places' && <Places d={d} />}
              {tab === 'flights' && <Flights d={d} />}
              {tab === 'trips' && <Trips d={d} />}
              {tab === 'movement' && <Movement d={d} />}
            </div>
          )}
          <footer className="mt-8 text-center text-xs text-ink-3">
            Data stays in your browser · Map data © Natural Earth, GeoNames, OurAirports/OpenFlights
          </footer>
        </div>
      </main>
    </div>
  )
}
