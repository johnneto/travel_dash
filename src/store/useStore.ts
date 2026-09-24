import { create } from 'zustand'
import type { Dataset, DateRange, Profile, Selection } from '../types'
import { loadRefData, type RefData } from '../lib/refdata'
import {
  clearDataset,
  emptyDataset,
  loadDataset,
  loadProfiles,
  newProfile,
  saveDataset,
  saveProfiles,
} from './db'
import type { WorkerResponse } from '../worker/import.worker'

export type Theme = 'light' | 'dark' | 'system'
export type Tab = 'overview' | 'places' | 'flights' | 'trips' | 'movement'

export interface ImportJob {
  id: number
  name: string
  /** Profile the file is being imported into (the active one when the import started). */
  profileId: string
  stage: string
  pct: number
  status: 'running' | 'done' | 'error'
  message?: string
}

interface State {
  ready: boolean
  ref: RefData | null
  profiles: Profile[]
  profileId: string
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
  switchProfile: (id: string) => Promise<void>
  createProfile: (name: string) => Promise<void>
  renameProfile: (id: string, name: string) => void
  deleteProfile: (id: string) => Promise<void>
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

export const hasAnyData = (d: Dataset) => d.flights.length > 0 || !!d.timeline

let worker: Worker | null = null
let jobSeq = 0
let switchSeq = 0
const getWorker = () =>
  (worker ??= new Worker(new URL('../worker/import.worker.ts', import.meta.url), {
    type: 'module',
  }))

/** Serialises dataset writes so imports finishing for an inactive profile don't race. */
let writes: Promise<unknown> = Promise.resolve()
const queue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = writes.then(fn)
  writes = next.catch(() => undefined)
  return next
}

/** Filters and selection belong to one profile's data, so they reset on every switch. */
const freshView = { range: { from: null, to: null }, country: null, selection: null }

export const useStore = create<State>((set, get) => ({
  ready: false,
  ref: null,
  profiles: [],
  profileId: '',
  data: emptyDataset(),
  ...freshView,
  tab: 'overview',
  theme: readTheme(),
  jobs: [],
  importOpen: false,

  init: async () => {
    const [ref, { profiles, activeId }] = await Promise.all([loadRefData(), loadProfiles()])
    const data = await loadDataset(activeId)
    set({ ref, profiles, profileId: activeId, data, ready: true, importOpen: !hasAnyData(data) })
  },

  importFiles: (files) => {
    const w = getWorker()
    const profileId = get().profileId
    for (const file of files) {
      const id = ++jobSeq
      set((s) => ({
        jobs: [
          ...s.jobs.filter((j) => j.status === 'running'),
          { id, name: file.name, profileId, stage: 'Queued', pct: 0, status: 'running' },
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
        if (!get().profiles.some((p) => p.id === profileId)) {
          return patch({ status: 'error', message: 'Profile was deleted', pct: 1 })
        }
        const now = new Date().toISOString()
        const apply = (data: Dataset): Dataset =>
          m.type === 'flights'
            ? { ...data, flights: m.flights, flightsImportedAt: now, flightsFile: m.name }
            : { ...data, timeline: m.timeline, timelineImportedAt: now, timelineFile: m.name }
        patch({
          status: 'done',
          pct: 1,
          message:
            m.type === 'flights'
              ? `${m.flights.length} flights imported` +
                (m.unknownAirports.length
                  ? ` · unknown airports skipped: ${m.unknownAirports.join(', ')}`
                  : '')
              : `${m.timeline.visits.length.toLocaleString()} visits · ${m.timeline.activities.length.toLocaleString()} journeys · ${m.timeline.trips.length} trips detected`,
        })
        void queue(async () => {
          if (get().profileId === profileId) {
            const data = apply(get().data)
            set({ data, selection: null })
            await saveDataset(profileId, data)
          } else {
            await saveDataset(profileId, apply(await loadDataset(profileId)))
          }
        })
      }
      w.addEventListener('message', onMsg)
      w.postMessage({ id, file })
    }
  },

  clear: async (what) => {
    const { data: d, profileId } = get()
    let data = d
    if (what === 'all') {
      data = emptyDataset()
    } else if (what === 'flights') {
      data = { ...d, flights: [], flightsImportedAt: null, flightsFile: null }
    } else {
      data = { ...d, timeline: null, timelineImportedAt: null, timelineFile: null }
    }
    set({ data, selection: null, country: null })
    await queue(() => (what === 'all' ? clearDataset(profileId) : saveDataset(profileId, data)))
  },

  switchProfile: async (id) => {
    if (id === get().profileId || !get().profiles.some((p) => p.id === id)) return
    const token = ++switchSeq
    const data = await queue(() => loadDataset(id))
    // A later switch may have started while this one was loading.
    if (token !== switchSeq) return
    // profileId and data change together, so nothing ever saves one profile's data under another.
    set({ profileId: id, data, ...freshView, importOpen: !hasAnyData(data) })
    await saveProfiles(get().profiles, id)
  },

  createProfile: async (name) => {
    const p = newProfile(name.trim() || `Profile ${get().profiles.length + 1}`)
    set((s) => ({ profiles: [...s.profiles, p] }))
    await get().switchProfile(p.id)
  },

  renameProfile: (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const profiles = get().profiles.map((p) => (p.id === id ? { ...p, name: trimmed } : p))
    set({ profiles })
    void saveProfiles(profiles, get().profileId)
  },

  deleteProfile: async (id) => {
    const { profiles, profileId } = get()
    if (profiles.length <= 1) return
    const rest = profiles.filter((p) => p.id !== id)
    set({ profiles: rest })
    await queue(() => clearDataset(id))
    if (id === profileId) await get().switchProfile(rest[0].id)
    else await saveProfiles(rest, profileId)
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
