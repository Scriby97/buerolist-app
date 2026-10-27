import { describe, expect, it } from 'vitest'
import { formatDecimalHours } from './hours'

describe('formatDecimalHours', () => {
  it('rechnet Minuten in Dezimalstunden um', () => {
    expect(formatDecimalHours(585)).toBe('9.75')
    expect(formatDecimalHours(270)).toBe('4.50')
    expect(formatDecimalHours(480)).toBe('8.00')
    expect(formatDecimalHours(20)).toBe('0.33')
  })
})
