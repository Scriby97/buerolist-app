// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectCombobox, filterProjectOptions, type ProjectOption } from './ProjectCombobox'

const options: ProjectOption[] = [
  { id: 'p-fassade', title: 'Fassade streichen', number: 12, customerName: 'Chalet Sonnhalde', customerNumber: 1 },
  { id: 'p-laeden', title: 'Fensterläden lackieren', number: 2, customerName: 'Chalet Sonnhalde', customerNumber: 1 },
  { id: 'p-treppe', title: 'Treppenhaus renovieren', number: 1, customerName: 'MFH Seestrasse 12', customerNumber: 2 },
]

const ids = (list: ProjectOption[]) => list.map((o) => o.id)

describe('filterProjectOptions', () => {
  it.each([
    ['001-12', ['p-fassade']],
    ['1-12', ['p-fassade']],
    ['00112', ['p-fassade']],
    ['002', ['p-treppe']],
    ['sonnhalde', ['p-fassade', 'p-laeden']],
    ['laden', ['p-laeden']], // ohne Umlaut
    ['chalet fass', ['p-fassade']], // mehrere Woerter
  ])('"%s" findet %j', (query, expected) => {
    expect(ids(filterProjectOptions(options, query))).toEqual(expected)
  })

  it('liefert ohne Suchbegriff alle Projekte', () => {
    expect(filterProjectOptions(options, '  ')).toHaveLength(3)
  })
})

function Controlled({ onChange }: { onChange: (id: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <ProjectCombobox
      id="project"
      options={options}
      value={value}
      onChange={(id) => {
        setValue(id)
        onChange(id)
      }}
      placeholder="Suchen"
      noMatchesText="Kein Projekt gefunden."
    />
  )
}

describe('ProjectCombobox', () => {
  it('zeigt die Projekte nach Nummer sortiert mit Nummer an', async () => {
    render(<Controlled onChange={vi.fn()} />)
    await userEvent.click(screen.getByRole('combobox'))

    const items = screen.getAllByRole('option').map((li) => li.textContent)
    expect(items).toEqual([
      '001-02Chalet Sonnhalde – Fensterläden lackieren',
      '001-12Chalet Sonnhalde – Fassade streichen',
      '002-01MFH Seestrasse 12 – Treppenhaus renovieren',
    ])
  })

  it('waehlt per Suche + Enter und zeigt danach Nummer und Namen an', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const input = screen.getByRole('combobox')

    await userEvent.type(input, '1-12{Enter}')

    expect(onChange).toHaveBeenCalledWith('p-fassade')
    expect((input as HTMLInputElement).value).toBe('001-12 Chalet Sonnhalde – Fassade streichen')
  })

  it('waehlt per Pfeiltaste und per Klick', async () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const input = screen.getByRole('combobox')

    await userEvent.type(input, 'chalet{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('p-fassade')

    await userEvent.click(input)
    await userEvent.click(screen.getByRole('option', { name: /Treppenhaus/ }))
    expect(onChange).toHaveBeenLastCalledWith('p-treppe')
  })

  it('meldet, wenn nichts gefunden wird', async () => {
    render(<Controlled onChange={vi.fn()} />)
    await userEvent.type(screen.getByRole('combobox'), 'xyz')
    expect(screen.getByText('Kein Projekt gefunden.')).toBeTruthy()
  })
})
