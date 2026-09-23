// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'

const router = { push: vi.fn(), back: vi.fn() }
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/settings',
  useSearchParams: () => new URLSearchParams(''),
}))

const auth = { isAdmin: false, loading: false, supabaseUser: { id: 'me' } as { id: string } | null }
vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => auth }))

const orgState = { selectedOrganizationRole: null as string | null }
vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ ...orgState }),
}))

vi.mock('@/lib/contexts/PendingInvitesContext', () => ({
  usePendingInvites: () => ({ pendingInvites: [], hasPendingInvites: false }),
}))

import SettingsPage from './page'

const hasLink = (href: string) => document.querySelector(`a[href="${href}"]`) !== null

describe('Einstellungen', () => {
  beforeEach(() => {
    router.push.mockReset()
    auth.isAdmin = false
    auth.loading = false
    auth.supabaseUser = { id: 'me' }
    orgState.selectedOrganizationRole = null
  })

  describe('User Management (Mitgliederverwaltung der gewählten Organisation)', () => {
    it.each(['owner', 'admin'])('is shown for the organization role %s', (role) => {
      orgState.selectedOrganizationRole = role

      renderWithIntl(<SettingsPage />)

      expect(screen.getByText('Benutzerverwaltung')).toBeInTheDocument()
      expect(hasLink('/admin/users')).toBe(true)
    })

    it('is hidden for employees', () => {
      orgState.selectedOrganizationRole = 'employee'

      renderWithIntl(<SettingsPage />)

      expect(hasLink('/admin/users')).toBe(false)
    })

    it.each(['owner', 'admin'])(
      'is shown for a system administrator who is %s of the organization',
      (role) => {
        auth.isAdmin = true
        orgState.selectedOrganizationRole = role

        renderWithIntl(<SettingsPage />)

        expect(hasLink('/admin/users')).toBe(true)
        // ... zusaetzlich zu den globalen Administrations-Kacheln
        expect(hasLink('/admin/all-users')).toBe(true)
        expect(hasLink('/admin/organizations')).toBe(true)
      },
    )

    it('is hidden for a system administrator without a role in the selected organization', () => {
      auth.isAdmin = true
      orgState.selectedOrganizationRole = null

      renderWithIntl(<SettingsPage />)

      expect(hasLink('/admin/users')).toBe(false)
      expect(hasLink('/admin/all-users')).toBe(true)
    })

    it('is hidden for a system administrator who is only an employee there', () => {
      auth.isAdmin = true
      orgState.selectedOrganizationRole = 'employee'

      renderWithIntl(<SettingsPage />)

      expect(hasLink('/admin/users')).toBe(false)
    })
  })

  describe('other tiles', () => {
    it('shows organization profile and billing only to owners', () => {
      orgState.selectedOrganizationRole = 'owner'
      const { unmount } = renderWithIntl(<SettingsPage />)
      expect(hasLink('/settings/organization')).toBe(true)
      expect(hasLink('/settings/billing')).toBe(true)
      unmount()

      orgState.selectedOrganizationRole = 'admin'
      renderWithIntl(<SettingsPage />)
      expect(hasLink('/settings/organization')).toBe(false)
      expect(hasLink('/settings/billing')).toBe(false)
    })

    it('shows the administration section only to system administrators', () => {
      const { unmount } = renderWithIntl(<SettingsPage />)
      expect(hasLink('/admin/all-users')).toBe(false)
      expect(hasLink('/admin/organizations')).toBe(false)
      unmount()

      auth.isAdmin = true
      renderWithIntl(<SettingsPage />)
      expect(hasLink('/admin/all-users')).toBe(true)
      expect(hasLink('/admin/organizations')).toBe(true)
    })

    it('always shows the personal tiles', () => {
      renderWithIntl(<SettingsPage />)

      for (const href of ['/settings/account', '/settings/appearance', '/impressum']) {
        expect(hasLink(href)).toBe(true)
      }
    })

    it.each(['owner', 'admin'])('shows category management for the organization role %s', (role) => {
      orgState.selectedOrganizationRole = role

      renderWithIntl(<SettingsPage />)

      expect(hasLink('/settings/categories')).toBe(true)
    })

    it('hides category management for employees', () => {
      orgState.selectedOrganizationRole = 'employee'

      renderWithIntl(<SettingsPage />)

      expect(hasLink('/settings/categories')).toBe(false)
    })
  })

  describe('login redirect', () => {
    it('sends logged-out visitors to the login', () => {
      auth.supabaseUser = null

      renderWithIntl(<SettingsPage />)

      expect(router.push).toHaveBeenCalledWith('/login')
    })

    it('does not redirect while the session is still loading', () => {
      auth.loading = true
      auth.supabaseUser = null

      renderWithIntl(<SettingsPage />)

      expect(router.push).not.toHaveBeenCalled()
    })
  })
})
