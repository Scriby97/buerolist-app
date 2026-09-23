// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'

const router = { push: vi.fn(), back: vi.fn() }
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams(''),
}))

const auth = {
  loading: false,
  isAdmin: false,
  userProfile: { id: 'me' },
  refreshOrganizations: vi.fn(),
}
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => auth }))

const orgState = {
  organizations: [{ id: 'org-1', name: 'Bergbahnen AG' }],
  selectedOrgId: 'org-1' as string | null,
  selectedOrganizationRole: null as string | null,
  isLoading: false,
}
vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ ...orgState }),
}))

const getOrganizationInvites = vi.fn()
vi.mock('@/lib/api/invites', () => ({
  createInvite: vi.fn(),
  deleteInvite: vi.fn(),
  getOrganizationInvites: (...args: unknown[]) => getOrganizationInvites(...args),
}))

const getOrganizationMembers = vi.fn()
vi.mock('@/lib/api/organizationMembers', () => ({
  getOrganizationMembers: (...args: unknown[]) => getOrganizationMembers(...args),
  updateMemberRole: vi.fn(),
  transferOwnership: vi.fn(),
  removeMember: vi.fn(),
}))

import UsersPage from './page'

const member = (role: string) => ({
  id: 'm1',
  userId: 'u1',
  organizationId: 'org-1',
  role,
  joinedAt: '2026-01-01T00:00:00.000Z',
  user: { id: 'u1', email: 'kollege@example.test', firstName: 'Kurt', lastName: 'Kollege' },
})

describe('User Management (Organisation)', () => {
  beforeEach(() => {
    router.push.mockReset()
    auth.loading = false
    auth.isAdmin = false
    orgState.selectedOrgId = 'org-1'
    orgState.selectedOrganizationRole = null
    orgState.isLoading = false
    getOrganizationInvites.mockReset()
    getOrganizationMembers.mockReset()
    getOrganizationInvites.mockResolvedValue([])
    getOrganizationMembers.mockResolvedValue([member('employee')])
  })

  describe.each(['owner', 'admin'])('organization %s', (role) => {
    it('sees the members and invites of the organization', async () => {
      orgState.selectedOrganizationRole = role

      renderWithIntl(<UsersPage />)

      expect((await screen.findAllByText('Kurt Kollege')).length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: 'Mitglieder' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Einladungen' })).toBeInTheDocument()
      expect(getOrganizationInvites).toHaveBeenCalledWith('org-1')
      expect(getOrganizationMembers).toHaveBeenCalledWith('org-1')
      expect(router.push).not.toHaveBeenCalled()
    })

    it('is not redirected away even if they are also a system administrator', async () => {
      auth.isAdmin = true
      orgState.selectedOrganizationRole = role

      renderWithIntl(<UsersPage />)

      expect((await screen.findAllByText('Kurt Kollege')).length).toBeGreaterThan(0)
      expect(router.push).not.toHaveBeenCalled()
      // die systemweite Benutzerliste gehoert nicht auf diese Seite
      expect(screen.queryByRole('button', { name: 'Benutzer' })).not.toBeInTheDocument()
    })
  })

  describe('redirects', () => {
    it('sends employees home', async () => {
      orgState.selectedOrganizationRole = 'employee'

      renderWithIntl(<UsersPage />)

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'))
      expect(getOrganizationMembers).not.toHaveBeenCalled()
    })

    it('sends users without a membership home', async () => {
      orgState.selectedOrganizationRole = null

      renderWithIntl(<UsersPage />)

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'))
    })

    it('sends a system administrator without a role in the organization to the global user list', async () => {
      auth.isAdmin = true
      orgState.selectedOrganizationRole = null

      renderWithIntl(<UsersPage />)

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/all-users'))
      expect(getOrganizationMembers).not.toHaveBeenCalled()
      expect(getOrganizationInvites).not.toHaveBeenCalled()
    })

    it('sends a system administrator who is only an employee there to the global user list', async () => {
      auth.isAdmin = true
      orgState.selectedOrganizationRole = 'employee'

      renderWithIntl(<UsersPage />)

      await waitFor(() => expect(router.push).toHaveBeenCalledWith('/admin/all-users'))
    })

    it('waits for auth and organization data before deciding', () => {
      auth.loading = true
      orgState.isLoading = true
      orgState.selectedOrganizationRole = null

      renderWithIntl(<UsersPage />)

      expect(router.push).not.toHaveBeenCalled()
      expect(getOrganizationMembers).not.toHaveBeenCalled()
    })

    it('does not redirect a manager while only the organization data is still loading', () => {
      orgState.isLoading = true
      orgState.selectedOrganizationRole = null

      renderWithIntl(<UsersPage />)

      expect(router.push).not.toHaveBeenCalled()
    })
  })
})
