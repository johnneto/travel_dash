import { describe, expect, it } from 'vitest'
import { HOME_WORK_SEMANTICS, placeStats } from './stats'
import type { Visit } from '../types'

const H = 3600000
const visit = (p: number, s: number, sem: string): Visit => ({ s, e: s + H, off: 0, p, sem })

describe('placeStats', () => {
  // Place 0 was Home, then the user moved to place 1 and later visited place 0 again.
  const visits = [
    visit(0, 0, 'Home'),
    visit(0, 10 * H, 'Home'),
    visit(1, 20 * H, 'Unknown'),
    visit(1, 30 * H, 'Home'),
    visit(0, 40 * H, 'Unknown'),
    visit(2, 50 * H, 'Inferred Work'),
  ]
  const away = placeStats(visits, (v) => !HOME_WORK_SEMANTICS.has(v.sem))

  it('excludes home/work by the label at the time of each visit', () => {
    expect(away.map((s) => [s.p, s.visits])).toEqual([
      [1, 1],
      [0, 1],
    ])
  })

  it('reports the latest label and every label seen', () => {
    const all = placeStats(visits)
    const p0 = all.find((s) => s.p === 0)!
    expect(p0.sem).toBe('Home')
    expect(p0.sems).toEqual(['Home'])
    expect(away.find((s) => s.p === 0)!.sem).toBe('Unknown')
    expect(all.find((s) => s.p === 1)!.sem).toBe('Home')
  })
})
