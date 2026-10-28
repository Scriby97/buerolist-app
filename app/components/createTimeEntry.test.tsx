// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import CreateTimeEntry from './createTimeEntry'

const createTimeEntryMock = vi.fn()
let canManage = true

vi.mock('@/lib/api/url', () => ({ getApiBaseUrlOrNull: () => 'http://api' }))
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ isAdmin: false, userProfile: { id: 'me', firstName: 'Nicolas', lastName: 'Balmer' } }),
}))
vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    organizations: [],
    selectedOrgId: 'org-1',
    setSelectedOrgId: vi.fn(),
    canManageSelectedOrganization: canManage,
  }),
}))
vi.mock('@/lib/api/projects', () => ({
  getProjects: () => Promise.resolve([{ id: 'p1', title: 'Holzwerk', number: 1, customer: { name: 'Chalet', number: 1 } }]),
  getProjectDetail: () => Promise.resolve({ categories: [] }),
}))
vi.mock('@/lib/api/timeEntries', () => ({
  getTimeEntries: () => Promise.resolve({ timeEntries: [], nextCursor: null }),
  createTimeEntry: (...args: unknown[]) => createTimeEntryMock(...args),
}))
vi.mock('@/lib/api/organizationMembers', () => ({
  getOrganizationMembers: () =>
    Promise.resolve([
      { userId: 'me', user: { id: 'me', firstName: 'Nicolas', lastName: 'Balmer', email: 'n@x.ch' } },
      { userId: 'ph', user: { id: 'ph', firstName: 'Max', lastName: 'Muster', email: null, isPlaceholder: true } },
    ]),
}))
vi.mock('./NotificationPermissionPrompt', () => ({ NotificationPermissionPrompt: () => null }))

const fillTimes = () => {
  fireEvent.change(screen.getByLabelText('Von'), { target: { value: '07:00' } })
  fireEvent.blur(screen.getByLabelText('Von'))
  fireEvent.change(screen.getByLabelText('Bis'), { target: { value: '09:00' } })
  fireEvent.blur(screen.getByLabelText('Bis'))
}

describe('CreateTimeEntry - für Mitarbeiter erfassen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    createTimeEntryMock.mockResolvedValue({})
  })

  it('Admin/Owner wählt einen Mitarbeiter ohne Login und speichert für ihn', async () => {
    canManage = true
    renderWithIntl(<CreateTimeEntry />)
    const select = await screen.findByLabelText('Mitarbeiter')
    expect(screen.getByRole('option', { name: 'Max Muster (ohne Login)' })).toBeTruthy()

    fireEvent.change(select, { target: { value: 'ph' } })
    fillTimes()
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))

    await waitFor(() => expect(createTimeEntryMock).toHaveBeenCalled())
    expect(createTimeEntryMock.mock.calls[0][0]).toMatchObject({ projectId: 'p1', creatorId: 'ph' })
  })

  it('ohne Auswahl wird für sich selbst gespeichert', async () => {
    canManage = true
    renderWithIntl(<CreateTimeEntry />)
    await screen.findByLabelText('Mitarbeiter')
    fillTimes()
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))

    await waitFor(() => expect(createTimeEntryMock).toHaveBeenCalled())
    expect(createTimeEntryMock.mock.calls[0][0].creatorId).toBeUndefined()
  })

  it('neuer Tag startet mit dem Arbeitsbeginn aus den Arbeitszeiten (07:15)', async () => {
    canManage = false
    renderWithIntl(<CreateTimeEntry />)
    await waitFor(() => expect((screen.getByLabelText('Von') as HTMLInputElement).value).toBe('07:15'))
  })

  it('Mitarbeiter sehen keine Mitarbeiterauswahl', async () => {
    canManage = false
    renderWithIntl(<CreateTimeEntry />)
    await screen.findByLabelText('Von')
    expect(screen.queryByLabelText('Mitarbeiter')).toBeNull()
  })
})
