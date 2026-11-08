// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'

// Stabiles Router-Objekt wie in Next.js - sonst laedt die Seite bei jedem Rendern neu
const router = { push: vi.fn(), back: vi.fn() }
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/all-users',
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ loading: false, isAdmin: true }) }))
vi.mock('@/lib/api/organizations', () => ({
  getAllOrganizations: vi.fn().mockResolvedValue([{ id: 'org-1', name: '3xGermann' }]),
}))
vi.mock('@/lib/api/invites', () => ({
  createInvite: vi.fn(),
  deleteInvite: vi.fn(),
  getOrganizationInvites: vi.fn().mockResolvedValue([]),
}))

const deleteUnusedPlaceholder = vi.fn()
const users = [
  { id: 'ph-org', email: null, isPlaceholder: true, role: 'user', firstName: 'Sklave', lastName: '01', organizationMemberships: [{ organizationId: 'org-1', role: 'employee' }] },
  { id: 'ph-orphan', email: null, isPlaceholder: true, role: 'user', firstName: 'Test', lastName: 'Platzhalter', organizationMemberships: [] },
  { id: 'real', email: 'info@3xgermann.ch', role: 'user', firstName: 'Martin', lastName: 'Germann', organizationMemberships: [] },
]
vi.mock('@/lib/api/users', () => ({
  getUsers: () => Promise.resolve(users),
  sendUserResetPassword: vi.fn(),
  deleteUnusedPlaceholder: (...args: unknown[]) => deleteUnusedPlaceholder(...args),
}))

import AllUsersPage from './page'

// Tabellenzeile (Desktop) eines Benutzers
const row = (name: string) => screen.getAllByText(name).map((el) => el.closest('tr')).find(Boolean)!

describe('Alle Benutzer', () => {
  beforeEach(() => {
    deleteUnusedPlaceholder.mockReset().mockResolvedValue(undefined)
  })

  it('zeigt Loeschen nur fuer Platzhalter ohne Organisation, Passwort-Reset nur mit E-Mail', async () => {
    renderWithIntl(<AllUsersPage />)
    await screen.findAllByText('Test Platzhalter')

    expect(within(row('Test Platzhalter')).getByRole('button', { name: 'Löschen' })).toBeTruthy()
    expect(within(row('Sklave 01')).queryByRole('button')).toBeNull()
    expect(within(row('Martin Germann')).getByRole('button', { name: 'Passwort zurücksetzen' })).toBeTruthy()
  })

  it('loescht den Platzhalter nach Bestaetigung und entfernt ihn aus der Liste', async () => {
    renderWithIntl(<AllUsersPage />)
    await screen.findAllByText('Test Platzhalter')

    fireEvent.click(within(row('Test Platzhalter')).getByRole('button', { name: 'Löschen' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Löschen' }))

    await waitFor(() => expect(deleteUnusedPlaceholder).toHaveBeenCalledWith('ph-orphan'))
    await waitFor(() => expect(screen.queryAllByText('Test Platzhalter')).toHaveLength(0))
  })
})
