import { describe, expect, it } from 'vitest'
import { aircraftSpec } from './aircraft'
import { profileShapes } from './aircraftProfile'

const TYPES = [
  'Airbus A320neo',
  'Airbus A380-800',
  'Boeing 737 MAX 8',
  'Boeing 747-400',
  'Boeing 787-9',
  'McDonnell Douglas MD-11',
  'Bombardier CRJ900',
  'ATR 72-600',
  'BAe 146',
  'Unknown type',
]

describe('profileShapes', () => {
  it.each(TYPES)('draws a finite, well-formed profile for %s', (name) => {
    const p = profileShapes(aircraftSpec(name))
    expect(p.viewBox.every(Number.isFinite)).toBe(true)
    expect(p.viewBox[2]).toBeGreaterThan(p.viewBox[3])
    for (const d of [...p.body, ...p.wing, ...p.engines.flatMap((e) => e.parts), p.cockpit]) {
      expect(d).toMatch(/^M[-\d.,]/)
      expect(d).not.toMatch(/NaN|Infinity/)
    }
  })

  it('draws one outlined engine per engine visible from the side', () => {
    const count = (n: string) => profileShapes(aircraftSpec(n)).engines.length
    expect(count('Airbus A320')).toBe(1)
    expect(count('Airbus A340-600')).toBe(2)
    expect(count('McDonnell Douglas MD-11')).toBe(2)
    expect(count('Embraer ERJ-145')).toBe(1)
  })

  it('adds propeller discs only to turboprops', () => {
    expect(profileShapes(aircraftSpec('ATR 72-600')).props).toHaveLength(1)
    expect(profileShapes(aircraftSpec('Airbus A320')).props).toHaveLength(0)
  })

  it('gives the 747 an upper-deck window row and the A380 two decks', () => {
    expect(profileShapes(aircraftSpec('Boeing 747-400')).windows).toHaveLength(2)
    expect(profileShapes(aircraftSpec('Airbus A380-800')).windows).toHaveLength(2)
    expect(profileShapes(aircraftSpec('Airbus A320')).windows).toHaveLength(1)
  })
})
