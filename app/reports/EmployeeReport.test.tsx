// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { EmployeeReport, type EmployeeReportOptions } from './EmployeeReport'
import type { TimeEntry } from '@/lib/api/timeEntries'

const entries = [
  {
    id: 'a',
    projectId: 'p1',
    startAt: '2026-10-13T07:00:00',
    endAt: '2026-10-13T12:00:00',
    comment: 'Gerüst gestellt',
    category: { id: 'c', name: 'Gerüstbau' },
    items: [{ id: 'i', type: 'material', quantity: 2, description: 'Kitt', unitPriceRappen: 1040 }],
    project: { id: 'p1', title: 'Holzwerk', number: 1, customerId: 'k', customerName: 'Chalet', customerNumber: 1 },
  },
] as unknown as TimeEntry[]

const all: EmployeeReportOptions = { category: true, comment: true, items: true, dayTotals: true, projectSummary: true }

describe('EmployeeReport', () => {
  it('zeigt Eintraege als Liste mit allen gewaehlten Inhalten und Totalen', () => {
    renderWithIntl(
      <EmployeeReport entries={entries} organizationName="3xGermann" employeeName="Anna Muster" periodLabel="Oktober 2026" options={all} />,
    )
    expect(screen.getByText('Arbeitsrapport')).toBeTruthy()
    expect(screen.getByText('Anna Muster')).toBeTruthy()
    expect(screen.getAllByText('001-01 Chalet – Holzwerk').length).toBeGreaterThan(0)
    expect(screen.getByText('Gerüstbau')).toBeTruthy()
    expect(screen.getByText('Gerüst gestellt')).toBeTruthy()
    expect(screen.getByText(/2× Kitt · CHF 20.80/)).toBeTruthy()
    expect(screen.getByText('Total Stunden').nextSibling?.textContent).toBe('5:00')
  })

  it('laesst abgewaehlte Inhalte weg', () => {
    renderWithIntl(
      <EmployeeReport
        entries={entries}
        organizationName="3xGermann"
        employeeName="Anna Muster"
        periodLabel="Oktober 2026"
        options={{ category: false, comment: false, items: false, dayTotals: false, projectSummary: false }}
      />,
    )
    expect(screen.queryByText('Gerüstbau')).toBeNull()
    expect(screen.queryByText('Gerüst gestellt')).toBeNull()
    expect(screen.queryByText(/Kitt/)).toBeNull()
    expect(screen.queryByText('Zusammenfassung pro Projekt')).toBeNull()
  })
})
