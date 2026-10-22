import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '@/lib/api/timeEntries'
import { buildReportData, formatHm, monthRange, rangeToIso } from './reportData'

const entry = (id: string, projectId: string, customerNumber: number, number: number, startAt: string, endAt: string, items: TimeEntry['items'] = []) =>
  ({
    id,
    projectId,
    startAt,
    endAt,
    items,
    project: { id: projectId, title: `Projekt ${projectId}`, number, customerId: 'c', customerName: 'Kunde', customerNumber },
  }) as unknown as TimeEntry

describe('reportData', () => {
  it('berechnet Monatsgrenzen inkl. Schaltjahr', () => {
    expect(monthRange(2026, 10)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthRange(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('setzt die Zeitraum-Grenzen auf ganze Tage', () => {
    const { startDate, endDate } = rangeToIso('2026-10-01', '2026-10-31')
    expect(new Date(startDate).getHours()).toBe(0)
    expect(new Date(endDate).getHours()).toBe(23)
  })

  it('gruppiert nach Tag (aufsteigend) und summiert Stunden, Material und Spesen', () => {
    const data = buildReportData([
      entry('b', 'p2', 2, 1, '2026-10-13T13:00:00', '2026-10-13T17:00:00'),
      entry('a', 'p1', 1, 3, '2026-10-13T07:00:00', '2026-10-13T12:00:00', [
        { id: 'i1', type: 'material', quantity: 2, description: 'Kitt', unitPriceRappen: 1040 },
        { id: 'i2', type: 'expense', quantity: 1, description: 'Parkieren', unitPriceRappen: 500 },
      ]),
      entry('c', 'p1', 1, 3, '2026-10-12T07:00:00', '2026-10-12T09:30:00'),
    ])

    expect(data.days.map((d) => d.key)).toEqual(['2026-10-12', '2026-10-13'])
    expect(data.days[1].entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(data.days[1].minutes).toBe(9 * 60)
    expect(data.totalMinutes).toBe(11 * 60 + 30)
    expect(data.materialRappen).toBe(2080)
    expect(data.expenseRappen).toBe(500)
    expect(data.projects.map((p) => [p.label.slice(0, 6), p.minutes])).toEqual([
      ['001-03', 7 * 60 + 30],
      ['002-01', 4 * 60],
    ])
  })

  it('formatiert Stunden als h:mm', () => {
    expect(formatHm(510)).toBe('8:30')
    expect(formatHm(0)).toBe('0:00')
  })
})
