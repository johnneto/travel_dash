import { describe, expect, it } from 'vitest'
import { rangeYear, yearRange } from './range'

describe('year ranges', () => {
  it('round-trips a calendar year', () => {
    expect(yearRange('2024')).toEqual({ from: '2024-01-01', to: '2024-12-31' })
    expect(rangeYear(yearRange('2024'))).toBe('2024')
  })

  it('returns null for other ranges', () => {
    expect(rangeYear({ from: null, to: null })).toBeNull()
    expect(rangeYear({ from: '2024-01-01', to: '2025-12-31' })).toBeNull()
    expect(rangeYear({ from: '2024-03-01', to: '2024-12-31' })).toBeNull()
  })
})
