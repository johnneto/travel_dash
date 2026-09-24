import { createStore, del, get, set } from 'idb-keyval'
import type { Dataset } from '../types'

export const DATASET_VERSION = 1
const store = createStore('travel-dash', 'data')
const KEY = 'dataset'

export const emptyDataset = (): Dataset => ({
  version: DATASET_VERSION,
  flights: [],
  flightsImportedAt: null,
  flightsFile: null,
  timeline: null,
  timelineImportedAt: null,
  timelineFile: null,
})

export async function loadDataset(): Promise<Dataset> {
  try {
    const d = await get<Dataset>(KEY, store)
    if (d && d.version === DATASET_VERSION) return d
  } catch (e) {
    console.warn('Could not read saved data', e)
  }
  return emptyDataset()
}

export async function saveDataset(d: Dataset) {
  try {
    await set(KEY, d, store)
  } catch (e) {
    console.warn('Could not persist data', e)
  }
}

export async function clearDataset() {
  await del(KEY, store)
}
