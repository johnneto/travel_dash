import { Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { useStore } from '../store/useStore'

/** Empty state for a section that needs a data source the active profile hasn't imported. */
export function MissingSource({ children }: { children: ReactNode }) {
  const setImportOpen = useStore((s) => s.setImportOpen)
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="max-w-md text-sm text-ink-3">{children}</p>
      <button
        onClick={() => setImportOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:border-accent hover:text-ink"
      >
        <Upload className="h-4 w-4" aria-hidden /> Import
      </button>
    </div>
  )
}
