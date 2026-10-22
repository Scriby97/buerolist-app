// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import { CategoryPicker } from './CategoryPicker'
import type { CategoryGroup } from '@/lib/api/categories'

const groups = [
  {
    id: 'g1', name: 'Malerarbeiten', number: 1, organizationId: 'o', createdAt: '',
    categories: [
      { id: 'a', name: 'Abdecken', number: 1, organizationId: 'o', createdAt: '' },
      { id: 'b', name: 'Streichen', number: 2, organizationId: 'o', createdAt: '' },
    ],
  },
  {
    id: 'g2', name: 'Bodenbelagsarbeiten', number: 2, organizationId: 'o', createdAt: '',
    categories: [{ id: 'c', name: 'Parkett', number: 1, organizationId: 'o', createdAt: '' }],
  },
] as CategoryGroup[]

const latest = { ids: [] as string[] }
function Harness({ initial }: { initial: string[] }) {
  const [ids, setIds] = useState(initial)
  return (
    <CategoryPicker
      groups={groups}
      selectedIds={ids}
      onChange={(next) => {
        latest.ids = next
        setIds(next)
      }}
    />
  )
}

describe('CategoryPicker', () => {
  it('zeigt Hauptkategorien zugeklappt (ohne Auswahl) und klappt sie mit Nummern auf', async () => {
    renderWithIntl(<Harness initial={[]} />)
    expect(screen.queryByText('Abdecken')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Malerarbeiten/ }))
    expect(screen.getByText('1.02')).toBeTruthy()
    expect(screen.getByText('Streichen')).toBeTruthy()
  })

  it('waehlt mit dem Gruppen-Kaestchen alle Kategorien einer Hauptkategorie', async () => {
    renderWithIntl(<Harness initial={['c']} />)
    await userEvent.click(screen.getByRole('checkbox', { name: 'Alle Kategorien in Malerarbeiten auswählen' }))
    expect(new Set(latest.ids)).toEqual(new Set(['a', 'b', 'c']))
    // Hauptkategorie mit gewaehlter Kategorie ist offen
    expect(screen.getByText('Parkett')).toBeTruthy()
  })
})
