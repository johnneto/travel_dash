import { useEffect, useState } from 'react'
import { getJson } from '../lib/refdata'

let cache: Promise<Record<string, string>> | null = null

/** State / region names keyed "CC.code" (GeoNames admin1), loaded the first time it's needed. */
export function useAdmin1(): Record<string, string> | null {
  const [names, setNames] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    let live = true
    cache ??= getJson<Record<string, string>>('admin1.json').catch((e) => {
      cache = null
      throw e
    })
    cache.then((n) => live && setNames(n)).catch((e) => console.warn('Could not load states', e))
    return () => {
      live = false
    }
  }, [])
  return names
}
