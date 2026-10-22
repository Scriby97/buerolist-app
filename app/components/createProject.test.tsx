// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import CreateProjectModal from './createProject'

const createProjectMock = vi.fn()

vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ selectedOrgId: 'org-1' }),
}))
vi.mock('@/lib/api/categories', () => ({
  getCategories: () => Promise.resolve([]),
  getCategoryGroups: () => Promise.resolve([]),
}))
vi.mock('@/lib/api/projects', () => ({
  createProject: (...args: unknown[]) => createProjectMock(...args),
}))

const renderModal = () =>
  renderWithIntl(<CreateProjectModal customerId="customer-1" onClose={vi.fn()} onCreated={vi.fn()} />)

describe('CreateProjectModal', () => {
  it('zeigt einen Hinweis statt still nichts zu tun, wenn die Projektbezeichnung fehlt', async () => {
    renderModal()
    const submit = screen.getByRole('button', { name: 'Projekt erstellen' })
    expect((submit as HTMLButtonElement).disabled).toBe(false)

    await userEvent.click(submit)

    expect(screen.getByText('Bitte gib eine Projektbezeichnung ein.')).toBeTruthy()
    expect(screen.getByLabelText('Projektbezeichnung').getAttribute('aria-invalid')).toBe('true')
    expect(createProjectMock).not.toHaveBeenCalled()
  })

  it('blendet den Hinweis beim Tippen aus und speichert dann normal', async () => {
    createProjectMock.mockResolvedValue({ id: 'p-1' })
    renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Projekt erstellen' }))
    await userEvent.type(screen.getByLabelText('Projektbezeichnung'), 'Holzwerk renovieren')
    expect(screen.queryByText('Bitte gib eine Projektbezeichnung ein.')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Projekt erstellen' }))
    expect(createProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Holzwerk renovieren', customerId: 'customer-1' }),
    )
  })
})
