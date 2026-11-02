// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { OverFreeLimitBanner, exceededFreeLimits } from './OverFreeLimitBanner'
import type { OrganizationSubscription } from '@/lib/types/user'

const getOrganizationSubscription = vi.fn()
let role: string | null = 'owner'

vi.mock('@/lib/api/organizations', () => ({
  getOrganizationSubscription: (...args: unknown[]) => getOrganizationSubscription(...args),
}))
vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ selectedOrgId: 'org', selectedOrganizationRole: role, isLoading: false }),
}))

const subscription = (overrides: Partial<OrganizationSubscription> = {}) =>
  ({
    tier: 'free',
    limits: { maxProjects: 100, maxMembers: 20, maxCustomers: 15, priceChf: 0 },
    usage: { projects: 12, members: 4, customers: 16 },
    ...overrides,
  }) as OrganizationSubscription

describe('exceededFreeLimits', () => {
  it('liefert nur die ueberschrittenen Limits im Free-Tarif', () => {
    expect(exceededFreeLimits(subscription())).toEqual([{ key: 'customers', used: 16, max: 15 }])
    expect(exceededFreeLimits(subscription({ tier: 'pro' } as Partial<OrganizationSubscription>))).toEqual([])
  })
})

describe('OverFreeLimitBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    role = 'owner'
    getOrganizationSubscription.mockResolvedValue(subscription())
  })

  it('zeigt Admins/Owner, was ueber dem Limit liegt', async () => {
    renderWithIntl(<OverFreeLimitBanner />)
    expect(await screen.findByText(/16 von 15 Kunden/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tarif ansehen' }).getAttribute('href')).toBe('/settings/billing')
  })

  it('verweist Admins an den Owner statt auf die Tarifseite', async () => {
    role = 'admin'
    renderWithIntl(<OverFreeLimitBanner />)
    expect(await screen.findByText(/nur der Eigentümer/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Tarif ansehen' })).toBeNull()
  })

  it('bleibt fuer Mitarbeiter aus', async () => {
    role = 'employee'
    renderWithIntl(<OverFreeLimitBanner />)
    await waitFor(() => expect(getOrganizationSubscription).not.toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
