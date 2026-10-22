// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import { CategoryTemplateSelect } from './CategoryTemplateSelect'

const getCategoryTemplatesMock = vi.fn()
vi.mock('@/lib/api/categories', () => ({
  getCategoryTemplates: (...args: unknown[]) => getCategoryTemplatesMock(...args),
}))

describe('CategoryTemplateSelect', () => {
  it('uebernimmt die Kategorien der gewaehlten Vorlage', async () => {
    getCategoryTemplatesMock.mockResolvedValue([
      { id: 't1', organizationId: 'o1', name: 'Holzwerkrenovation', categoryIds: ['a', 'b'] },
    ])
    const onApply = vi.fn()
    renderWithIntl(<CategoryTemplateSelect organizationId="o1" onApply={onApply} />)

    const select = await screen.findByLabelText('Vorlage:')
    await userEvent.selectOptions(select, 't1')

    expect(onApply).toHaveBeenCalledWith(['a', 'b'])
    expect(screen.getByRole('option', { name: 'Holzwerkrenovation (2)' })).toBeTruthy()
  })

  it('erscheint nicht ohne Vorlagen', async () => {
    getCategoryTemplatesMock.mockResolvedValue([])
    const { container } = renderWithIntl(<CategoryTemplateSelect organizationId="o1" onApply={vi.fn()} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.textContent).toBe('')
  })
})
