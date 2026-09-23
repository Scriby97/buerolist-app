// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import type { Organization, OrganizationMembership } from '@/lib/types/user'

const getAllOrganizations = vi.fn()
vi.mock('@/lib/api/organizations', () => ({
  getAllOrganizations: (...args: unknown[]) => getAllOrganizations(...args),
}))

const refreshOrganizations = vi.fn()
const auth = {
  isAdmin: false,
  organizationId: null as string | null,
  organizationMemberships: [] as OrganizationMembership[],
  loading: false,
  refreshOrganizations: (...args: unknown[]) => refreshOrganizations(...args),
}
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => auth }))

import { OrganizationProvider, useOrganization } from './OrganizationContext'

const org = (id: string, name: string, logoUrl: string | null = null): Organization => ({
  id,
  name,
  logoUrl,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const membership = (
  organization: Organization,
  role: OrganizationMembership['role'],
): OrganizationMembership => ({
  id: `m-${organization.id}`,
  userId: 'me',
  organizationId: organization.id,
  organization,
  role,
  joinedAt: '2026-01-01T00:00:00.000Z',
})

function Probe() {
  const ctx = useOrganization()
  return (
    <div>
      <p data-testid="loading">{String(ctx.isLoading)}</p>
      <p data-testid="selected">{ctx.selectedOrgId ?? 'none'}</p>
      <p data-testid="role">{ctx.selectedOrganizationRole ?? 'none'}</p>
      <p data-testid="canManage">{String(ctx.canManageSelectedOrganization)}</p>
      <p data-testid="error">{ctx.error ?? ''}</p>
      <ul>
        {ctx.organizations.map((o) => (
          <li key={o.id}>{`${o.name}|${o.logoUrl ?? 'no-logo'}`}</li>
        ))}
      </ul>
      <button onClick={() => void ctx.refetchOrganizations()}>refetch</button>
      <button onClick={() => ctx.setSelectedOrgId('org-2')}>select-2</button>
      <button onClick={() => ctx.setSelectedOrgId(null)}>select-none</button>
    </div>
  )
}

const renderProbe = () =>
  renderWithIntl(
    <OrganizationProvider>
      <Probe />
    </OrganizationProvider>,
  )

describe('OrganizationContext', () => {
  beforeEach(() => {
    getAllOrganizations.mockReset()
    refreshOrganizations.mockReset()
    refreshOrganizations.mockResolvedValue(undefined)
    window.localStorage.clear()
    auth.isAdmin = false
    auth.organizationId = null
    auth.organizationMemberships = []
    auth.loading = false
  })

  describe('global administrator', () => {
    beforeEach(() => {
      auth.isAdmin = true
    })

    it('loads all organizations once and selects the first one', async () => {
      getAllOrganizations.mockResolvedValue([org('org-1', 'Alpha'), org('org-2', 'Beta')])

      renderProbe()

      expect(await screen.findByText('Alpha|no-logo')).toBeInTheDocument()
      expect(screen.getByText('Beta|no-logo')).toBeInTheDocument()
      expect(screen.getByTestId('selected')).toHaveTextContent('org-1')
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
      expect(getAllOrganizations).toHaveBeenCalledTimes(1)
    })

    it('restores the previously chosen organization from localStorage', async () => {
      window.localStorage.setItem('buerolist:selectedOrgId', 'org-2')
      getAllOrganizations.mockResolvedValue([org('org-1', 'Alpha'), org('org-2', 'Beta')])

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-2'))
    })

    it('falls back to the first organization if the stored one no longer exists', async () => {
      window.localStorage.setItem('buerolist:selectedOrgId', 'gone')
      getAllOrganizations.mockResolvedValue([org('org-1', 'Alpha')])

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-1'))
    })

    it('can manage every organization without a membership', async () => {
      getAllOrganizations.mockResolvedValue([org('org-1', 'Alpha')])

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('canManage')).toHaveTextContent('true'))
      expect(screen.getByTestId('role')).toHaveTextContent('none')
    })

    it('shows changes made to an organization after refetchOrganizations (e.g. a new logo)', async () => {
      getAllOrganizations
        .mockResolvedValueOnce([org('org-1', 'Alpha')])
        .mockResolvedValueOnce([org('org-1', 'Alpha', 'https://cdn.test/new-logo.png')])
      renderProbe()
      await screen.findByText('Alpha|no-logo')

      await userEvent.click(screen.getByRole('button', { name: 'refetch' }))

      expect(await screen.findByText('Alpha|https://cdn.test/new-logo.png')).toBeInTheDocument()
      expect(getAllOrganizations).toHaveBeenCalledTimes(2)
      // die Auswahl bleibt beim Neuladen erhalten
      expect(screen.getByTestId('selected')).toHaveTextContent('org-1')
    })

    it('does not use the membership refresh for admins', async () => {
      getAllOrganizations.mockResolvedValue([org('org-1', 'Alpha')])
      renderProbe()
      await screen.findByText('Alpha|no-logo')

      await userEvent.click(screen.getByRole('button', { name: 'refetch' }))

      await waitFor(() => expect(getAllOrganizations).toHaveBeenCalledTimes(2))
      expect(refreshOrganizations).not.toHaveBeenCalled()
    })

    it('reports a load failure and stops loading', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      getAllOrganizations.mockRejectedValue(new Error('server down'))

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('server down'))
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
      consoleError.mockRestore()
    })
  })

  describe('regular user', () => {
    it('derives the organizations from the memberships without an extra request', async () => {
      auth.organizationMemberships = [
        membership(org('org-1', 'Alpha'), 'employee'),
        membership(org('org-2', 'Beta'), 'owner'),
      ]

      renderProbe()

      expect(await screen.findByText('Alpha|no-logo')).toBeInTheDocument()
      expect(screen.getByText('Beta|no-logo')).toBeInTheDocument()
      expect(getAllOrganizations).not.toHaveBeenCalled()
    })

    it('prefers the primary organization from the profile as initial selection', async () => {
      auth.organizationId = 'org-2'
      auth.organizationMemberships = [
        membership(org('org-1', 'Alpha'), 'employee'),
        membership(org('org-2', 'Beta'), 'owner'),
      ]

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-2'))
    })

    it('exposes the role of the SELECTED organization, not of the first membership', async () => {
      auth.organizationMemberships = [
        membership(org('org-1', 'Alpha'), 'employee'),
        membership(org('org-2', 'Beta'), 'owner'),
      ]
      renderProbe()
      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-1'))
      expect(screen.getByTestId('role')).toHaveTextContent('employee')
      expect(screen.getByTestId('canManage')).toHaveTextContent('false')

      await userEvent.click(screen.getByRole('button', { name: 'select-2' }))

      expect(screen.getByTestId('role')).toHaveTextContent('owner')
      expect(screen.getByTestId('canManage')).toHaveTextContent('true')
    })

    it.each([
      ['admin', 'true'],
      ['owner', 'true'],
      ['employee', 'false'],
    ] as const)('canManage for role %s is %s', async (role, expected) => {
      auth.organizationMemberships = [membership(org('org-1', 'Alpha'), role)]

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-1'))
      expect(screen.getByTestId('canManage')).toHaveTextContent(expected)
    })

    it('persists the choice in localStorage', async () => {
      auth.organizationMemberships = [
        membership(org('org-1', 'Alpha'), 'employee'),
        membership(org('org-2', 'Beta'), 'employee'),
      ]
      renderProbe()
      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-1'))

      await userEvent.click(screen.getByRole('button', { name: 'select-2' }))

      expect(window.localStorage.getItem('buerolist:selectedOrgId')).toBe('org-2')
    })

    it('restores a stored selection only if it is still one of the memberships', async () => {
      window.localStorage.setItem('buerolist:selectedOrgId', 'left-org')
      auth.organizationMemberships = [membership(org('org-1', 'Alpha'), 'employee')]

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-1'))
    })

    it('delegates refetchOrganizations to the auth refresh instead of the admin endpoint', async () => {
      auth.organizationMemberships = [membership(org('org-1', 'Alpha'), 'owner')]
      renderProbe()
      await waitFor(() => expect(screen.getByTestId('selected')).toHaveTextContent('org-1'))

      await userEvent.click(screen.getByRole('button', { name: 'refetch' }))

      expect(refreshOrganizations).toHaveBeenCalledTimes(1)
      expect(getAllOrganizations).not.toHaveBeenCalled()
    })

    it('stops loading when the user has no organization at all', async () => {
      auth.organizationMemberships = []

      renderProbe()

      await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
      expect(screen.getByTestId('selected')).toHaveTextContent('none')
    })

    it('stays in the loading state while the auth data is still loading', () => {
      auth.loading = true
      auth.organizationMemberships = []

      renderProbe()

      // Sonst wuerde ein Redirect-Guard (z.B. /admin/users) faelschlich "keine Organisation" annehmen.
      expect(screen.getByTestId('loading')).toHaveTextContent('true')
    })

    it('follows membership changes (e.g. after accepting an invite)', async () => {
      auth.organizationMemberships = [membership(org('org-1', 'Alpha'), 'employee')]
      const { rerender } = renderProbe()
      await screen.findByText('Alpha|no-logo')

      auth.organizationMemberships = [
        membership(org('org-1', 'Alpha'), 'employee'),
        membership(org('org-3', 'Gamma'), 'employee'),
      ]
      await act(async () => {
        rerender(
          <OrganizationProvider>
            <Probe />
          </OrganizationProvider>,
        )
      })

      expect(await screen.findByText('Gamma|no-logo')).toBeInTheDocument()
    })
  })
})
