// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import CreateCustomerModal from './createCustomer'
import CreateProjectModal from './createProject'

const updateCustomerMock = vi.fn()
const updateProjectMock = vi.fn()

vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ selectedOrgId: 'org-1' }),
}))
vi.mock('@/lib/api/customers', () => ({
  createCustomer: vi.fn(),
  updateCustomer: (...args: unknown[]) => updateCustomerMock(...args),
}))
vi.mock('@/lib/api/projects', () => ({
  createProject: vi.fn(),
  updateProject: (...args: unknown[]) => updateProjectMock(...args),
}))
vi.mock('@/lib/api/categories', () => ({
  getCategories: () => Promise.resolve([]),
  getCategoryGroups: () => Promise.resolve([]),
  getCategoryTemplates: () => Promise.resolve([]),
}))

beforeEach(() => vi.clearAllMocks())

describe('Kunde bearbeiten', () => {
  const customer = {
    id: 'c1',
    organizationId: 'org-1',
    number: 1,
    name: 'Chalet Sonnhalde',
    contactEmail: 'alt@example.ch',
    contactPhone: '033 000 00 11',
    address: 'Sonnhaldenweg 7',
    createdAt: '',
    updatedAt: '',
  }

  it('fuellt die Felder vor und speichert die Aenderungen (leere Felder als null)', async () => {
    updateCustomerMock.mockResolvedValue({ ...customer, contactPhone: '079 123 45 67', contactEmail: null })
    const onCreated = vi.fn()
    renderWithIntl(<CreateCustomerModal customer={customer} onClose={vi.fn()} onCreated={onCreated} />)

    expect(screen.getByText('Kunde bearbeiten')).toBeTruthy()
    const phone = screen.getByLabelText('Telefon')
    expect((phone as HTMLInputElement).value).toBe('033 000 00 11')

    await userEvent.clear(phone)
    await userEvent.type(phone, '079 123 45 67')
    await userEvent.clear(screen.getByLabelText('E-Mail'))
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(updateCustomerMock).toHaveBeenCalledWith('c1', {
      name: 'Chalet Sonnhalde',
      contactEmail: null,
      contactPhone: '079 123 45 67',
      address: 'Sonnhaldenweg 7',
    })
    expect(onCreated).toHaveBeenCalled()
  })
})

describe('Projekt bearbeiten', () => {
  it('aendert die Projektbezeichnung', async () => {
    updateProjectMock.mockResolvedValue({ id: 'p1', title: 'Fassade Nordseite streichen' })
    const onCreated = vi.fn()
    renderWithIntl(
      <CreateProjectModal
        customerId="c1"
        project={{ id: 'p1', title: 'Fassade streichen' }}
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    )

    expect(screen.getByText('Projekt bearbeiten')).toBeTruthy()
    const title = screen.getByLabelText('Projektbezeichnung')
    await userEvent.clear(title)
    await userEvent.type(title, 'Fassade Nordseite streichen')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    expect(updateProjectMock).toHaveBeenCalledWith('p1', { title: 'Fassade Nordseite streichen' })
    expect(onCreated).toHaveBeenCalledWith({ id: 'p1', title: 'Fassade Nordseite streichen' })
  })
})
