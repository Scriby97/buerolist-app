// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { CategoryEffortChart } from './CategoryEffortChart'

describe('CategoryEffortChart', () => {
  it('sortiert nach Aufwand, hebt die aufwaendigste Kategorie hervor und zeigt Stunden + Anteil', () => {
    render(
      <CategoryEffortChart
        title="Aufwand pro Kategorie"
        rows={[
          { key: 's', label: 'Streichen', totalMinutes: 90 },
          { key: 'a', label: 'Abdecken', totalMinutes: 870 },
          { key: 'g', label: 'Gerüstbau', totalMinutes: 450 },
        ]}
      />,
    )
    const items = within(screen.getByRole('list', { name: 'Aufwand pro Kategorie' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Abdecken14:30'),
      expect.stringContaining('Gerüstbau7:30'),
      expect.stringContaining('Streichen1:30'),
    ])
    // 870 / 1410 = 62 %
    expect(items[0].textContent).toContain('62 %')
    expect(within(items[0]).getByText('Abdecken').className).toContain('font-semibold')
    expect(within(items[1]).getByText('Gerüstbau').className).not.toContain('font-semibold')
  })
})
