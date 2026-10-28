// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MultiSelectDropdown } from './MultiSelectDropdown'

const options = Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, label: `Person ${i}` }))

const renderDropdown = (selected: string[], onChange = vi.fn()) =>
  render(
    <MultiSelectDropdown
      id="x"
      options={options}
      selected={selected}
      onChange={onChange}
      emptyText="Niemand"
      searchPlaceholder="Suchen"
      noMatchesText="Keine"
    />,
  )

describe('MultiSelectDropdown', () => {
  it('fasst die Auswahl zusammen', () => {
    renderDropdown(['u0', 'u1', 'u2'])
    expect(screen.getByRole('button').textContent).toContain('Person 0 +2')
  })

  it('sucht und schaltet Eintraege um', () => {
    const onChange = vi.fn()
    renderDropdown(['u0'], onChange)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByPlaceholderText('Suchen'), { target: { value: '5' } })
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Person 5' }))
    expect(onChange).toHaveBeenCalledWith(['u0', 'u5'])
  })
})
