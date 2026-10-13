// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import { ProjectTimeReport } from './ProjectTimeReport'

vi.mock('@/lib/api/timeEntries', () => ({
  getTimeEntries: () =>
    Promise.resolve({
      nextCursor: null,
      timeEntries: [
        {
          id: 'a',
          creatorId: 'anna',
          startAt: '2026-10-13T07:00:00',
          endAt: '2026-10-13T12:00:00',
          comment: 'Gerüst gestellt',
          category: { id: 'c1', name: 'Gerüstbau' },
          creator: { id: 'anna', firstName: 'Anna', lastName: 'Muster', email: 'a@x.ch' },
        },
        {
          id: 'b',
          creatorId: 'beat',
          startAt: '2026-10-13T07:00:00',
          endAt: '2026-10-13T10:30:00',
          comment: null,
          category: null,
          creator: { id: 'beat', firstName: 'Beat', lastName: 'Beispiel', email: 'b@x.ch' },
        },
      ],
    }),
}))

describe('ProjectTimeReport', () => {
  it('zeigt die Matrix mit Totals und klappt einen Tag zu den Einzeleintraegen auf', async () => {
    renderWithIntl(
      <ProjectTimeReport projectId="p1" organizationId="o1" projectTitle="Fassade" onClose={vi.fn()} />,
    )

    expect(await screen.findByRole('columnheader', { name: 'Anna Muster' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Beat Beispiel' })).toBeTruthy()
    // Tageszeile + Wochenzeile + Totalzeile enthalten 8:30 (5:00 + 3:30)
    expect(screen.getAllByText('8:30').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText('Gerüst gestellt')).toBeNull()

    await userEvent.click(screen.getByRole('button', { expanded: false }))
    expect(screen.getByText('Gerüst gestellt')).toBeTruthy()
    expect(screen.getByText(/Ohne Kategorie/)).toBeTruthy()
  })
})
