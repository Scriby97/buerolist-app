import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '@/lib/api/timeEntries'
import { buildTimeMatrix, formatHoursMinutes, isoWeek } from './buildTimeMatrix'

const entry = (id: string, creatorId: string, firstName: string, startAt: string, endAt: string) =>
  ({
    id,
    creatorId,
    startAt,
    endAt,
    creator: { id: creatorId, firstName, email: `${firstName}@x.ch` },
  }) as unknown as TimeEntry

describe('isoWeek', () => {
  it.each([
    ['2026-10-12', 2026, 42], // Montag
    ['2026-10-18', 2026, 42], // Sonntag gleiche Woche
    ['2027-01-01', 2026, 53], // Freitag gehoert noch zur letzten KW des Vorjahres
    ['2026-01-01', 2026, 1],
  ])('%s -> %i/KW %i', (date, year, week) => {
    const [y, m, d] = date.split('-').map(Number)
    expect(isoWeek(new Date(y, m - 1, d))).toEqual({ isoYear: year, isoWeek: week })
  })
})

describe('buildTimeMatrix', () => {
  const entries = [
    // Woche 42
    entry('a', 'anna', 'Anna', '2026-10-13T11:00:00', '2026-10-13T15:00:00'),
    entry('b', 'anna', 'Anna', '2026-10-13T05:00:00', '2026-10-13T10:00:00'),
    entry('c', 'beat', 'Beat', '2026-10-13T06:00:00', '2026-10-13T08:30:00'),
    entry('d', 'beat', 'Beat', '2026-10-12T06:00:00', '2026-10-12T07:00:00'),
    // Woche 41
    entry('e', 'anna', 'Anna', '2026-10-09T06:00:00', '2026-10-09T08:00:00'),
  ]
  const matrix = buildTimeMatrix(entries)

  it('ordnet Mitarbeiter nach Stunden absteigend', () => {
    expect(matrix.employees.map((e) => e.name)).toEqual(['Anna', 'Beat'])
  })

  it('gruppiert nach Woche und Tag, jeweils neueste zuerst', () => {
    expect(matrix.weeks.map((w) => w.isoWeek)).toEqual([42, 41])
    expect(matrix.weeks[0].days.map((d) => d.key)).toEqual(['2026-10-13', '2026-10-12'])
  })

  it('summiert pro Tag, Woche und Mitarbeiter', () => {
    const day = matrix.weeks[0].days[0]
    expect(day.minutesByEmployee).toEqual({ anna: 9 * 60, beat: 150 })
    expect(day.totalMinutes).toBe(9 * 60 + 150)
    expect(matrix.weeks[0].minutesByEmployee).toEqual({ anna: 9 * 60, beat: 210 })
    expect(matrix.minutesByEmployee).toEqual({ anna: 11 * 60, beat: 210 })
    expect(matrix.totalMinutes).toBe(11 * 60 + 210)
  })

  it('listet die Eintraege eines Tages zeitlich aufsteigend', () => {
    expect(matrix.weeks[0].days[0].entries.map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('formatHoursMinutes', () => {
  it('formatiert als h:mm und laesst 0 leer', () => {
    expect(formatHoursMinutes(510)).toBe('8:30')
    expect(formatHoursMinutes(60)).toBe('1:00')
    expect(formatHoursMinutes(0)).toBe('')
  })
})
