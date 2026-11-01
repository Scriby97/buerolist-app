// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { EmployeeReport, type EmployeeReportOptions } from './EmployeeReport'
import type { TimeEntry } from '@/lib/api/timeEntries'
import type { Absence } from '@/lib/api/absences'

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

const all: EmployeeReportOptions = {
  category: true,
  comment: true,
  items: true,
  dayTotals: true,
  projectSummary: true,
  absences: true,
}

const absence = (id: string, date: string, minutes: number, reason: string) =>
  ({ id, date, minutes, comment: null, reason: { id: null, number: null, name: reason } }) as unknown as Absence

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
        options={{ category: false, comment: false, items: false, dayTotals: false, projectSummary: false, absences: false }}
      />,
    )
    expect(screen.queryByText('Gerüstbau')).toBeNull()
    expect(screen.queryByText('Gerüst gestellt')).toBeNull()
    expect(screen.queryByText(/Kitt/)).toBeNull()
    expect(screen.queryByText('Zusammenfassung pro Projekt')).toBeNull()
  })

  it('weist Abwesenheiten getrennt aus, mit Summe pro Grund', () => {
    renderWithIntl(
      <EmployeeReport
        entries={entries}
        absences={[
          absence('x', '2026-10-14', 525, 'Krankheit'),
          absence('y', '2026-10-15', 525, 'Krankheit'),
          absence('z', '2026-10-16', 150, 'Feuerwehr'),
        ]}
        organizationName="3xGermann"
        employeeName="Anna Muster"
        periodLabel="Oktober 2026"
        options={all}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Abwesenheiten' })).toBeTruthy()
    expect(screen.getByText('Total Arbeitszeit').nextSibling?.textContent).toBe('5:00')
    expect(screen.getAllByText('Krankheit').at(-1)!.nextSibling?.textContent).toBe('17:30')
    expect(screen.getAllByText('Feuerwehr').at(-1)!.nextSibling?.textContent).toBe('2:30')
    expect(screen.getByText('Total inkl. Abwesenheiten').nextSibling?.textContent).toBe('25:00')
  })
})
