import { create } from 'zustand'
import type { Dataset, DateRange, Selection } from '../types'
import { loadRefData, type RefData } from '../lib/refdata'
import { clearDataset, emptyDataset, loadDataset, saveDataset } from './db'
import type { WorkerResponse } from '../worker/import.worker'

export type Theme = 'light' | 'dark' | 'system'
export type Tab = 'overview' | 'places' | 'flights' | 'trips' | 'movement'

export interface ImportJob {
  id: number
  name: string
  stage: string
  pct: number
  status: 'running' | 'done' | 'error'
  message?: string
}

interface State {
  ready: boolean
  ref: RefData | null
  data: Dataset
  range: DateRange
  country: string | null
  selection: Selection
  tab: Tab
  theme: Theme
  jobs: ImportJob[]
  importOpen: boolean
  init: () => Promise<void>
  importFiles: (files: File[]) => void
  clear: (what: 'flights' | 'timeline' | 'all') => Promise<void>
  setRange: (r: DateRange) => void
  setCountry: (cc: string | null) => void
  select: (s: Selection) => void
  setTab: (t: Tab) => void
  setTheme: (t: Theme) => void
  setImportOpen: (o: boolean) => void
}

const readTheme = (): Theme => {
  try {
    return (localStorage.getItem('theme') as Theme) || 'system'
  } catch {
    return 'system'
  }
}

let worker: Worker | null = null
let jobSeq = 0
const getWorker = () =>
  (worker ??= new Worker(new URL('../worker/import.worker.ts', import.meta.url), {
    type: 'module',
  }))

export const useStore = create<State>((set, get) => ({
  ready: false,
  ref: null,
  data: emptyDataset(),
  range: { from: null, to: null },
  country: null,
  selection: null,
  tab: 'overview',
  theme: readTheme(),
  jobs: [],
  importOpen: false,

  init: async () => {
    const [ref, data] = await Promise.all([loadRefData(), loadDataset()])
    set({ ref, data, ready: true, importOpen: !data.flights.length && !data.timeline })
  },

  importFiles: (files) => {
    const w = getWorker()
    for (const file of files) {
      const id = ++jobSeq
      set((s) => ({
        jobs: [
          ...s.jobs.filter((j) => j.status === 'running'),
          { id, name: file.name, stage: 'Queued', pct: 0, status: 'running' },
        ],
      }))
      const onMsg = (ev: MessageEvent<WorkerResponse>) => {
        const m = ev.data
        if (m.id !== id) return
        const patch = (p: Partial<ImportJob>) =>
          set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) }))
        if (m.type === 'progress') return patch({ stage: m.stage, pct: m.pct })
        w.removeEventListener('message', onMsg)
        if (m.type === 'error') return patch({ status: 'error', message: m.message, pct: 1 })
        const now = new Date().toISOString()
        let data = get().data
        if (m.type === 'flights') {
          data = { ...data, flights: m.flights, flightsImportedAt: now, flightsFile: m.name }
          patch({
            status: 'done',
            pct: 1,
            message:
              `${m.flights.length} flights imported` +
              (m.unknownAirports.length
                ? ` · unknown airports skipped: ${m.unknownAirports.join(', ')}`
                : ''),
          })
        } else {
          data = { ...data, timeline: m.timeline, timelineImportedAt: now, timelineFile: m.name }
          patch({
            status: 'done',
            pct: 1,
            message: `${m.timeline.visits.length.toLocaleString()} visits · ${m.timeline.activities.length.toLocaleString()} journeys · ${m.timeline.trips.length} trips detected`,
          })
        }
        set({ data, selection: null })
        void saveDataset(data)
      }
      w.addEventListener('message', onMsg)
      w.postMessage({ id, file })
    }
  },

  clear: async (what) => {
    const d = get().data
    let data = d
    if (what === 'all') {
      await clearDataset()
      data = emptyDataset()
    } else if (what === 'flights') {
      data = { ...d, flights: [], flightsImportedAt: null, flightsFile: null }
    } else {
      data = { ...d, timeline: null, timelineImportedAt: null, timelineFile: null }
    }
    set({ data, selection: null, country: null })
    if (what !== 'all') await saveDataset(data)
  },

  setRange: (range) => set({ range }),
  setCountry: (country) =>
    set({ country, selection: country ? { type: 'country', cc: country } : null }),
  select: (selection) => set({ selection }),
  setTab: (tab) => set({ tab }),
  setTheme: (theme) => {
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
    set({ theme })
  },
  setImportOpen: (importOpen) => set({ importOpen }),
}))
