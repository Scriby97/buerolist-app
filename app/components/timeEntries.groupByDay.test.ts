import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '@/lib/api/timeEntries'
import { groupByDay } from './timeEntries'

const entry = (id: string, startAt: string, endAt: string) =>
  ({ id, startAt, endAt }) as unknown as TimeEntry

describe('groupByDay', () => {
  it('listet Tage neueste zuerst, Eintraege innerhalb eines Tages aber zeitlich aufsteigend', () => {
    // So kommen sie von der API: neueste zuerst.
    const groups = groupByDay([
      entry('di-nachmittag', '2026-10-13T07:00:00.000Z', '2026-10-13T15:00:00.000Z'),
      entry('di-morgen', '2026-10-13T05:00:00.000Z', '2026-10-13T07:00:00.000Z'),
      entry('mo', '2026-10-12T05:00:00.000Z', '2026-10-12T15:00:00.000Z'),
    ])

    expect(groups.map((g) => g.entries.map((e) => e.id))).toEqual([
      ['di-morgen', 'di-nachmittag'],
      ['mo'],
    ])
    expect(groups[0].totalMinutes).toBe(10 * 60)
  })
})
