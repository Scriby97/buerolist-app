// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import MyEntries from './timeEntries'

const pad2 = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`

const getAbsences = vi.fn()
const deleteAbsence = vi.fn()
let canManage = false

vi.mock('@/lib/api/url', () => ({ getApiBaseUrlOrNull: () => 'http://api' }))
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ isAdmin: false, userProfile: { id: 'me', firstName: 'Nicolas', lastName: 'Balmer' } }),
}))
vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({
    organizations: [],
    selectedOrgId: 'org',
    setSelectedOrgId: vi.fn(),
    canManageSelectedOrganization: canManage,
  }),
}))
vi.mock('@/lib/api/timeEntries', () => ({
  getTimeEntries: () => Promise.resolve({ timeEntries: [], nextCursor: null }),
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
}))
vi.mock('@/lib/api/organizationMembers', () => ({ getOrganizationMembers: () => Promise.resolve([]) }))
vi.mock('@/lib/api/itemPresets', () => ({ getItemPresets: () => Promise.resolve([]) }))
vi.mock('@/lib/api/absences', () => ({
  getAbsences: (...args: unknown[]) => getAbsences(...args),
  deleteAbsence: (...args: unknown[]) => deleteAbsence(...args),
  getAbsenceReasons: () => Promise.resolve([]),
  updateAbsence: vi.fn(),
}))

const sick = {
  id: 'a1',
  organizationId: 'org',
  creatorId: 'me',
  date: today,
  minutes: 525,
  comment: 'Grippe',
  reason: { id: 'r1', name: 'Krankheit' },
  creator: { id: 'me', firstName: 'Nicolas', lastName: 'Balmer' },
  createdBy: null,
}

describe('Einträge - Abwesenheiten', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canManage = false
    getAbsences.mockResolvedValue([sick])
    deleteAbsence.mockResolvedValue(undefined)
  })

  it('zeigt die Abwesenheit des gewaehlten Tages mit Tagestotal', async () => {
    renderWithIntl(<MyEntries />)
    expect(await screen.findByText('Abwesenheit: Krankheit')).toBeTruthy()
    expect(screen.getByText('Grippe')).toBeTruthy()
    expect(screen.getByText(/8\.75 h/, { selector: 'span' })).toBeTruthy()
    // Mitarbeiter: keine Personenauswahl (das Backend liefert nur die eigenen)
    expect(getAbsences.mock.calls[0][1]).toMatchObject({ creatorId: undefined })
  })

  it('loescht eine eigene Abwesenheit nach Bestaetigung', async () => {
    renderWithIntl(<MyEntries />)
    await screen.findByText('Abwesenheit: Krankheit')
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }))
    await waitFor(() => expect(deleteAbsence).toHaveBeenCalledWith('a1'))
    await waitFor(() => expect(screen.queryByText('Abwesenheit: Krankheit')).toBeNull())
  })

  it('sperrt vom Admin erfasste Abwesenheiten fuer Mitarbeiter', async () => {
    getAbsences.mockResolvedValue([{ ...sick, createdBy: { id: 'boss', firstName: 'Chef' } }])
    renderWithIntl(<MyEntries />)
    await screen.findByText('Abwesenheit: Krankheit')
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull()
  })
})
