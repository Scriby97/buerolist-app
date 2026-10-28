import { describe, expect, it } from 'vitest'
import { formatDecimalHours, minutesToDecimalInput, parseDecimalHours } from './hours'

describe('formatDecimalHours', () => {
  it('rechnet Minuten in Dezimalstunden um', () => {
    expect(formatDecimalHours(585)).toBe('9.75')
    expect(formatDecimalHours(270)).toBe('4.50')
    expect(formatDecimalHours(480)).toBe('8.00')
    expect(formatDecimalHours(20)).toBe('0.33')
  })
})

describe('parseDecimalHours', () => {
  it('liest Dezimalstunden mit Punkt oder Komma', () => {
    expect(parseDecimalHours('1.25')).toBe(75)
    expect(parseDecimalHours('1,5')).toBe(90)
    expect(parseDecimalHours('2')).toBe(120)
    expect(parseDecimalHours('  ')).toBeNull()
  })

  it('erkennt ungueltige Eingaben', () => {
    expect(parseDecimalHours('abc')).toBeUndefined()
    expect(parseDecimalHours('-1')).toBeUndefined()
    expect(parseDecimalHours('25')).toBeUndefined()
    expect(parseDecimalHours('1.255')).toBeUndefined()
  })

  it('zeigt Minuten wieder als Eingabe', () => {
    expect(minutesToDecimalInput(75)).toBe('1.25')
    expect(minutesToDecimalInput(90)).toBe('1.5')
    expect(minutesToDecimalInput(null)).toBe('')
  })
})

