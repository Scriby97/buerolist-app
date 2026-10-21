// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import { ProjectEntryComments } from './ProjectEntryComments'

const getTimeEntriesMock = vi.fn()
vi.mock('@/lib/api/timeEntries', () => ({
  getTimeEntries: (...args: unknown[]) => getTimeEntriesMock(...args),
}))

const entry = (id: string, startAt: string, comment: string | null) => ({
  id,
  startAt,
  endAt: startAt,
  comment,
  category: { id: 'c', name: 'Abdecken' },
  creator: { id: 'u', firstName: 'Anna', lastName: 'Muster', email: 'a@x.ch' },
})

describe('ProjectEntryComments', () => {
  it('zeigt die Bemerkungen zugeklappt mit Anzahl und klappt sie neueste zuerst auf', async () => {
    getTimeEntriesMock.mockResolvedValue({
      nextCursor: null,
      timeEntries: [
        entry('a', '2026-10-12T07:00:00', 'Gerüst gestellt'),
        entry('b', '2026-10-13T07:00:00', 'Holz morsch'),
        entry('c', '2026-10-14T07:00:00', null),
      ],
    })
    renderWithIntl(<ProjectEntryComments projectId="p1" organizationId="o1" />)

    const toggle = await screen.findByRole('button', { name: /Bemerkungen aus Einträgen/ })
    expect(toggle.textContent).toContain('(2)')
    expect(screen.queryByText('Holz morsch')).toBeNull()

    await userEvent.click(toggle)
    const comments = screen.getAllByText(/Gerüst gestellt|Holz morsch/).map((el) => el.textContent)
    expect(comments).toEqual(['Holz morsch', 'Gerüst gestellt'])
    expect(getTimeEntriesMock).toHaveBeenCalledWith('o1', expect.objectContaining({ projectId: 'p1' }))
  })

  it('erscheint nicht, wenn es keine Bemerkungen gibt', async () => {
    getTimeEntriesMock.mockResolvedValue({ nextCursor: null, timeEntries: [entry('a', '2026-10-12T07:00:00', null)] })
    const { container } = renderWithIntl(<ProjectEntryComments projectId="p1" organizationId="o1" />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toBe('')
  })
})
