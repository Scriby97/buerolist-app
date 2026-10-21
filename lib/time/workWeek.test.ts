import { describe, expect, it } from 'vitest'
import { currentWeekStartKey, isInCurrentWeek } from './workWeek'

describe('workWeek', () => {
  const wednesday = new Date(2026, 9, 21, 10, 0) // Mi, 21.10.2026

  it('Woche beginnt am Montag', () => {
    expect(currentWeekStartKey(wednesday)).toBe('2026-10-19')
    expect(currentWeekStartKey(new Date(2026, 9, 25, 23, 0))).toBe('2026-10-19') // Sonntag
    expect(currentWeekStartKey(new Date(2026, 9, 26, 0, 5))).toBe('2026-10-26') // Montag
  })

  it('nur Eintraege ab Montag dieser Woche gelten als aktuell', () => {
    expect(isInCurrentWeek(new Date(2026, 9, 19, 7, 0).toISOString(), wednesday)).toBe(true)
    expect(isInCurrentWeek(new Date(2026, 9, 18, 17, 0).toISOString(), wednesday)).toBe(false)
  })
})
