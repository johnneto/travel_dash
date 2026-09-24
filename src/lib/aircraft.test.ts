import { describe, expect, it } from 'vitest'
import { aircraftSpec } from './aircraft'

describe('aircraftSpec', () => {
  it('tells A320 family variants apart', () => {
    expect(aircraftSpec('Airbus A320')).toMatchObject({ length: 37.6, winglet: 'fence' })
    expect(aircraftSpec('Airbus A320neo')).toMatchObject({ length: 37.6, winglet: 'sharklet' })
    expect(aircraftSpec('Airbus A321-200').length).toBe(44.5)
    expect(aircraftSpec('Airbus A319').length).toBe(33.8)
  })

  it('tells 737 generations apart', () => {
    expect(aircraftSpec('Boeing 737-800')).toMatchObject({ length: 39.5, winglet: 'blended' })
    expect(aircraftSpec('Boeing 737 MAX 8')).toMatchObject({ length: 39.5, winglet: 'split' })
    expect(aircraftSpec('Boeing 737-8')).toMatchObject({ winglet: 'split' })
    expect(aircraftSpec('Boeing 737 MAX 9').length).toBe(42.2)
    expect(aircraftSpec('Boeing 737-900ER')).toMatchObject({ length: 42.1, winglet: 'blended' })
    expect(aircraftSpec('Boeing 737-700').length).toBe(33.6)
    expect(aircraftSpec('Boeing 737-300').winglet).toBe('none')
  })

  it('captures the distinctive shapes', () => {
    expect(aircraftSpec('Boeing 747-400')).toMatchObject({ deck: 'hump', engines: 'wing4' })
    expect(aircraftSpec('Airbus A380-800')).toMatchObject({ deck: 'double', engines: 'wing4' })
    expect(aircraftSpec('Boeing 787-9 Dreamliner')).toMatchObject({ nose: 'b787', length: 62.8 })
    expect(aircraftSpec('Boeing 787-10').length).toBe(68.3)
    expect(aircraftSpec('Boeing 777-300ER').length).toBe(73.9)
    expect(aircraftSpec('McDonnell Douglas MD-11')).toMatchObject({ engines: 'tail3' })
    expect(aircraftSpec('McDonnell Douglas MD-88')).toMatchObject({ engines: 'tail2', tail: 'T' })
  })

  it('recognises regional aircraft', () => {
    expect(aircraftSpec('Embraer E190')).toMatchObject({ length: 36.2, engines: 'wing2' })
    expect(aircraftSpec('Embraer 175').length).toBe(31.7)
    expect(aircraftSpec('Embraer ERJ-145')).toMatchObject({ engines: 'tail2' })
    expect(aircraftSpec('Bombardier CRJ900').length).toBe(36.4)
    expect(aircraftSpec('Bombardier CRJ1000').length).toBe(39.1)
    expect(aircraftSpec('ATR 72-600')).toMatchObject({ engines: 'prop2', wing: 'high' })
    expect(aircraftSpec('De Havilland Canada Dash 8-400').length).toBe(32.8)
    expect(aircraftSpec('Sukhoi Superjet 100')).toMatchObject({ engines: 'wing2', tail: 'low' })
  })

  it('falls back to a generic narrow-body', () => {
    expect(aircraftSpec('')).toMatchObject({ engines: 'wing2', length: 37.6 })
    expect(aircraftSpec('Mystery Jet 9000').engines).toBe('wing2')
  })
})
