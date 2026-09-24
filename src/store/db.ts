import { createStore, del, get, set } from 'idb-keyval'
import type { Dataset, Profile } from '../types'

export const DATASET_VERSION = 1
const store = createStore('travel-dash', 'data')
/** Pre-profiles single dataset key, migrated into the default profile on first load. */
const LEGACY_KEY = 'dataset'
const PROFILES_KEY = 'profiles'
const ACTIVE_KEY = 'activeProfile'
const datasetKey = (profileId: string) => `dataset:${profileId}`

export const emptyDataset = (): Dataset => ({
  version: DATASET_VERSION,
  flights: [],
  flightsImportedAt: null,
  flightsFile: null,
  timeline: null,
  timelineImportedAt: null,
  timelineFile: null,
})

export const newProfile = (name: string): Profile => ({
  id: crypto.randomUUID(),
  name,
  createdAt: new Date().toISOString(),
})

/** Loads the profile list and the active profile id, creating a default profile if needed. */
export async function loadProfiles(): Promise<{ profiles: Profile[]; activeId: string }> {
  let profiles: Profile[] = []
  let activeId: string | undefined
  try {
    profiles = (await get<Profile[]>(PROFILES_KEY, store)) ?? []
    activeId = await get<string>(ACTIVE_KEY, store)
  } catch (e) {
    console.warn('Could not read profiles', e)
  }
  if (!profiles.length) {
    const first = newProfile('Me')
    profiles = [first]
    activeId = first.id
    try {
      const legacy = await get<Dataset>(LEGACY_KEY, store)
      if (legacy) {
        await set(datasetKey(first.id), legacy, store)
        await del(LEGACY_KEY, store)
      }
      await saveProfiles(profiles, first.id)
    } catch (e) {
      console.warn('Could not migrate saved data', e)
    }
  }
  if (!activeId || !profiles.some((p) => p.id === activeId)) activeId = profiles[0].id
  return { profiles, activeId }
}

export async function saveProfiles(profiles: Profile[], activeId: string) {
  try {
    await set(PROFILES_KEY, profiles, store)
    await set(ACTIVE_KEY, activeId, store)
  } catch (e) {
    console.warn('Could not persist profiles', e)
  }
}

export async function loadDataset(profileId: string): Promise<Dataset> {
  try {
    const d = await get<Dataset>(datasetKey(profileId), store)
    if (d && d.version === DATASET_VERSION) return d
  } catch (e) {
    console.warn('Could not read saved data', e)
  }
  return emptyDataset()
}

export async function saveDataset(profileId: string, d: Dataset) {
  try {
    await set(datasetKey(profileId), d, store)
  } catch (e) {
    console.warn('Could not persist data', e)
  }
}

export async function clearDataset(profileId: string) {
  await del(datasetKey(profileId), store)
}
