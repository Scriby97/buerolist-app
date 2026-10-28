// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { EntryItemsEditor, matchPresets } from './EntryItemsEditor'
import { withTrailingEmptyRow, type ItemRow } from '@/lib/timeEntryItems'
import type { ItemPreset } from '@/lib/api/itemPresets'

const presets: ItemPreset[] = [
  { id: 'a', organizationId: 'o', type: 'expense', number: 1, description: 'Mittagessen', unitPriceRappen: 2200 },
  { id: 'b', organizationId: 'o', type: 'expense', number: 2, description: 'Parkieren', unitPriceRappen: null },
]

function Harness({ onRows }: { onRows: (rows: ItemRow[]) => void }) {
  const [rows, setRows] = useState<ItemRow[]>(withTrailingEmptyRow([]))
  return (
    <EntryItemsEditor
      idPrefix="expense"
      title="Spesen"
      rows={rows}
      presets={presets}
      onChange={(next) => {
        setRows(next)
        onRows(next)
      }}
    />
  )
}

describe('EntryItemsEditor - Vorlagen im Bezeichnungsfeld', () => {
  it('findet Vorlagen ueber Nummer oder Bezeichnung', () => {
    expect(matchPresets(presets, 'mittag').map((p) => p.id)).toEqual(['a'])
    expect(matchPresets(presets, 's-002').map((p) => p.id)).toEqual(['b'])
    expect(matchPresets(presets, '')).toHaveLength(2)
  })

  it('uebernimmt eine gewaehlte Vorlage mit Preis und Menge 1', () => {
    const onRows = vi.fn()
    renderWithIntl(<Harness onRows={onRows} />)
    const input = screen.getByRole('combobox', { name: 'Spesen 1: Bezeichnung' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'mit' } })
    fireEvent.mouseDown(screen.getByRole('option', { name: /Mittagessen/ }))
    expect(onRows).toHaveBeenLastCalledWith([
      { quantity: '1', description: 'Mittagessen', price: '22.00' },
      { quantity: '', description: '', price: '' },
    ])
  })

  it('freie Eingabe bleibt moeglich', () => {
    const onRows = vi.fn()
    renderWithIntl(<Harness onRows={onRows} />)
    const input = screen.getByRole('combobox', { name: 'Spesen 1: Bezeichnung' })
    fireEvent.change(input, { target: { value: 'Znüni' } })
    expect(screen.queryByRole('option')).toBeNull()
    expect(onRows.mock.lastCall?.[0][0].description).toBe('Znüni')
  })
})
