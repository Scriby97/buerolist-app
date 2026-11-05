// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { ProjectReport, entriesToSummaryRows, type ProjectReportOptions } from './ProjectReport'
import type { TimeEntry } from '@/lib/api/timeEntries'
import type { ProjectDetail } from '@/lib/api/projects'

const project = { id: 'p1', title: 'Holzwerk', number: 1, customer: { id: 'k', name: 'Chalet', number: 1 } }

const entry = (id: string, creator: string, category: string, start: string, end: string, extra = {}) => ({
  id,
  projectId: 'p1',
  creatorId: creator,
  categoryId: category,
  startAt: start,
  endAt: end,
  comment: null,
  category: { id: category, name: category === 'c1' ? 'Gerüstbau' : 'Streichen' },
  creator: { id: creator, firstName: creator === 'u1' ? 'Anna' : 'Beat', lastName: 'Muster', email: `${creator}@x.ch` },
  project,
  items: [],
  ...extra,
})

const entries = [
  entry('a', 'u1', 'c1', '2026-10-13T07:00:00', '2026-10-13T12:00:00', {
    comment: 'Gerüst gestellt',
    items: [{ id: 'i', type: 'material', quantity: 2, description: 'Kitt', unitPriceRappen: 1040 }],
  }),
  entry('b', 'u2', 'c2', '2026-10-14T07:00:00', '2026-10-14T09:30:00', {
    travelMinutes: 45,
    items: [
      { id: 'j', type: 'material', quantity: 1, description: 'kitt', unitPriceRappen: 1040 },
      { id: 'k', type: 'expense', quantity: 1, description: 'Parkgebühr', unitPriceRappen: 500 },
    ],
  }),
] as unknown as TimeEntry[]

const detail = {
  project,
  categories: [],
  timeSummary: [],
  notes: [
    {
      id: 'n',
      text: 'Fassade Nordseite beachten',
      createdAt: '2026-10-12T10:00:00Z',
      photos: [{ id: 'ph', noteId: 'n', url: 'https://example.com/a.jpg', createdAt: '2026-10-12T10:00:00Z' }],
    },
  ],
} as unknown as ProjectDetail

const all: ProjectReportOptions = { summary: true, chart: true, costs: true, entries: true, comments: true, notes: true, photos: true }
const none: ProjectReportOptions = { summary: false, chart: false, costs: false, entries: false, comments: false, notes: false, photos: false }

describe('entriesToSummaryRows', () => {
  it('summiert Minuten pro Mitarbeiter und Kategorie', () => {
    const rows = entriesToSummaryRows([...entries, entries[0]])
    expect(rows.find((r) => r.creatorId === 'u1')?.totalMinutes).toBe(600)
    expect(rows.find((r) => r.creatorId === 'u2')?.totalMinutes).toBe(150)
  })
})

describe('ProjectReport', () => {
  it('zeigt alle gewaehlten Abschnitte', () => {
    const { container } = renderWithIntl(
      <ProjectReport detail={detail} entries={entries} organizationName="3xGermann" periodLabel="Ganzes Projekt" options={all} />,
    )
    expect(screen.getByText('Projektrapport')).toBeTruthy()
    expect(screen.getByText('001-01 Chalet – Holzwerk')).toBeTruthy()
    expect(screen.getByText('Zeit-Zusammenfassung')).toBeTruthy()
    expect(screen.getByText('Aufwand nach Kategorie')).toBeTruthy()
    // Liste (Handy) und Tabelle (breit/Druck) - per CSS ist jeweils nur eine sichtbar
    expect(screen.getAllByText('Gerüst gestellt')).toHaveLength(2)
    expect(screen.getAllByText(/2× Kitt · CHF 20.80/)).toHaveLength(2)
    expect(screen.getByText('Fassade Nordseite beachten')).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.jpg')
  })

  it('listet Material und Spesen einzeln mit Totalen und zeigt die Fahrzeit', () => {
    renderWithIntl(
      <ProjectReport detail={detail} entries={entries} organizationName="3xGermann" periodLabel="Ganzes Projekt" options={all} />,
    )
    // "Kitt" und "kitt" zum gleichen Preis werden zusammengefasst: 3 x 10.40
    const kitt = screen.getByRole('cell', { name: 'Kitt' }).closest('tr')!
    expect(kitt.textContent).toContain('31.20')
    expect(screen.getByRole('cell', { name: 'Parkgebühr' })).toBeTruthy()
    expect(screen.getByText('Total Material').closest('tr')!.textContent).toContain('31.20')
    expect(screen.getByText('Total Spesen').closest('tr')!.textContent).toContain('5.00')
    expect(screen.getByText('Total Material & Spesen').closest('tr')!.textContent).toContain('36.20')
    expect(screen.getAllByText('0.75').length).toBeGreaterThan(0)
  })

  it('zeigt auch Notizen und Fotos beim Kunden, gekennzeichnet', () => {
    const customerNotes = [
      {
        id: 'cn',
        text: 'Kunde in den Ferien',
        createdAt: '2026-10-01T10:00:00Z',
        photos: [{ id: 'cph', noteId: 'cn', url: 'https://example.com/k.jpg', createdAt: '2026-10-01T10:00:00Z' }],
      },
    ] as unknown as ProjectDetail['notes']
    const { container } = renderWithIntl(
      <ProjectReport
        detail={{ ...detail, notes: [] }}
        customerNotes={customerNotes}
        entries={entries}
        organizationName="3xGermann"
        periodLabel="Ganzes Projekt"
        options={all}
      />,
    )
    expect(screen.getByText('Kunde in den Ferien')).toBeTruthy()
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://example.com/k.jpg')
    expect(screen.getAllByText(/Notiz zum Kunden/).length).toBe(2)
  })

  it('laesst abgewaehlte Abschnitte weg', () => {
    const { container } = renderWithIntl(
      <ProjectReport detail={detail} entries={entries} organizationName="3xGermann" periodLabel="Ganzes Projekt" options={none} />,
    )
    expect(screen.queryByText('Zeit-Zusammenfassung')).toBeNull()
    expect(screen.queryByText('Aufwand nach Kategorie')).toBeNull()
    expect(screen.queryByText('Gerüst gestellt')).toBeNull()
    expect(screen.queryByText('Fassade Nordseite beachten')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    // Gesamttotal steht immer im Kopf
    expect(screen.getByText('7.50')).toBeTruthy()
  })
})
