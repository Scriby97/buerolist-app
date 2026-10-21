// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import { EntryItemsEditor } from './EntryItemsEditor'
import { withTrailingEmptyRow, type ItemRow } from '@/lib/timeEntryItems'

function Harness() {
  const [rows, setRows] = useState<ItemRow[]>(withTrailingEmptyRow([]))
  return <EntryItemsEditor idPrefix="material" title="Material" rows={rows} onChange={setRows} />
}

const descriptionInputs = () => screen.getAllByRole('textbox', { name: /Bezeichnung/ })

describe('EntryItemsEditor', () => {
  it('zeigt nach dem Ausfuellen automatisch eine neue leere Zeile und das Total', async () => {
    renderWithIntl(<Harness />)
    expect(descriptionInputs()).toHaveLength(1)

    await userEvent.type(screen.getByRole('textbox', { name: 'Material 1: Bezeichnung' }), 'Patrone Kitt')
    await userEvent.type(screen.getByRole('textbox', { name: 'Material 1: CHF/Stk.' }), '10.40')
    expect(descriptionInputs()).toHaveLength(2)

    await userEvent.type(screen.getByRole('textbox', { name: 'Material 2: Menge' }), '2')
    await userEvent.type(screen.getByRole('textbox', { name: 'Material 2: Bezeichnung' }), 'Abdeckband')
    await userEvent.type(screen.getByRole('textbox', { name: 'Material 2: CHF/Stk.' }), '4,50')
    expect(descriptionInputs()).toHaveLength(3)

    // 1 x 10.40 + 2 x 4.50
    expect(screen.getByText('CHF 19.40')).toBeTruthy()
  })

  it('entfernt eine ausgefuellte Zeile', async () => {
    renderWithIntl(<Harness />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Material 1: Bezeichnung' }), 'Kitt')
    expect(descriptionInputs()).toHaveLength(2)

    await userEvent.click(screen.getByRole('button', { name: 'Material 1: Entfernen' }))

    expect(descriptionInputs()).toHaveLength(1)
    expect((descriptionInputs()[0] as HTMLInputElement).value).toBe('')
  })
})
