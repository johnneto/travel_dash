import {
  CheckCircle2,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Lock,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useStore } from '../store/useStore'
import { fmtDate, fmtNum } from '../lib/format'

export function ImportDialog() {
  const open = useStore((s) => s.importOpen)
  const setOpen = useStore((s) => s.setImportOpen)
  const importFiles = useStore((s) => s.importFiles)
  const jobs = useStore((s) => s.jobs)
  const data = useStore((s) => s.data)
  const clear = useStore((s) => s.clear)
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const hasData = data.flights.length > 0 || !!data.timeline

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hasData && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hasData, setOpen])

  if (!open) return null

  const onFiles = (list: FileList | null) => {
    if (list?.length) importFiles([...list])
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
      onClick={(e) => e.target === e.currentTarget && hasData && setOpen(false)}
    >
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="import-title" className="text-lg font-semibold">
              {hasData ? 'Update your data' : 'Welcome to Travel Dash'}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              Drop your Flighty CSV and/or Google Maps Timeline JSON. A new file replaces the data
              of the same type.
            </p>
          </div>
          {hasData && (
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            onFiles(e.dataTransfer.files)
          }}
          className={clsx(
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
            drag ? 'border-accent bg-accent/5' : 'border-line hover:border-accent',
          )}
        >
          <Upload className="h-7 w-7 text-accent" aria-hidden />
          <span className="text-sm font-medium">Drop files here or click to browse</span>
          <span className="text-xs text-ink-3">
            FlightyExport-*.csv · Timeline.json (iOS or Android export)
          </span>
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {jobs.length > 0 && (
          <ul className="mt-4 space-y-2">
            {jobs.map((j) => (
              <li key={j.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex items-center gap-2">
                  {j.status === 'running' && (
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  )}
                  {j.status === 'done' && <CheckCircle2 className="h-4 w-4 text-good" />}
                  {j.status === 'error' && <TriangleAlert className="h-4 w-4 text-bad" />}
                  <span className="min-w-0 flex-1 truncate font-medium">{j.name}</span>
                  <span className="text-xs text-ink-3">
                    {j.status === 'running' ? j.stage : ''}
                  </span>
                </div>
                {j.status === 'running' && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${Math.round(j.pct * 100)}%` }}
                    />
                  </div>
                )}
                {j.message && (
                  <p
                    className={clsx(
                      'mt-1 text-xs',
                      j.status === 'error' ? 'text-bad' : 'text-ink-2',
                    )}
                  >
                    {j.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SourceCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Flighty"
            file={data.flightsFile}
            at={data.flightsImportedAt}
            summary={data.flights.length ? `${fmtNum(data.flights.length)} flights` : null}
            how="Flighty app → Settings → Export flight data (CSV)."
            onClear={() => clear('flights')}
          />
          <SourceCard
            icon={<FileJson className="h-5 w-5" />}
            title="Google Maps Timeline"
            file={data.timelineFile}
            at={data.timelineImportedAt}
            summary={
              data.timeline
                ? `${fmtNum(data.timeline.visits.length)} visits · ${fmtDate(data.timeline.range.start, 'month')} – ${fmtDate(data.timeline.range.end, 'month')}`
                : null
            }
            how="Google Maps app → Settings → Location & privacy → Export Timeline data."
            onClear={() => clear('timeline')}
          />
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs text-ink-3">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Files are processed in your browser and stored only in this browser (IndexedDB). Nothing
          is uploaded anywhere.
        </p>
        {hasData && (
          <button
            onClick={() => clear('all')}
            className="mt-3 text-xs font-medium text-bad hover:underline"
          >
            Delete all stored data
          </button>
        )}
      </div>
    </div>
  )
}

function SourceCard({
  icon,
  title,
  file,
  at,
  summary,
  how,
  onClear,
}: {
  icon: React.ReactNode
  title: string
  file: string | null
  at: string | null
  summary: string | null
  how: string
  onClear: () => void
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3.5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <span className="text-accent">{icon}</span>
        {title}
        {summary && (
          <button
            onClick={onClear}
            aria-label={`Remove ${title} data`}
            className="ml-auto text-ink-3 hover:text-bad"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {summary ? (
        <p className="mt-1.5 text-xs text-ink-2">
          <span className="font-medium text-ink">{summary}</span>
          <br />
          <span className="break-all">{file}</span> · imported {at ? fmtDate(at) : ''}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-ink-3">Not imported yet. {how}</p>
      )}
    </div>
  )
}
