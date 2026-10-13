// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithIntl } from '@/test/renderWithIntl'
import { TimeInput, parseTime } from './TimeInput'

describe('parseTime', () => {
  it.each([
    ['7', '07:00'],
    ['730', '07:30'],
    ['0730', '07:30'],
    ['1730', '17:30'],
    ['7:30', '07:30'],
    ['17.15', '17:15'],
    ['23:59', '23:59'],
  ])('%s -> %s', (raw, expected) => {
    expect(parseTime(raw)).toBe(expected)
  })

  it.each(['24:00', '12:60', 'abc', '', '12345'])('lehnt %j ab', (raw) => {
    expect(parseTime(raw)).toBeNull()
  })
})

function Controlled({ onChange }: { onChange: (v: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <TimeInput
      id="t"
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange(v)
      }}
    />
  )
}

describe('TimeInput', () => {
  it('normalisiert getippte Zeiten beim Verlassen des Feldes auf HH:MM (24 h)', async () => {
    const onChange = vi.fn()
    renderWithIntl(<Controlled onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await userEvent.type(input, '1730')
    await userEvent.tab()

    expect(onChange).toHaveBeenLastCalledWith('17:30')
    expect((input as HTMLInputElement).value).toBe('17:30')
  })

  it('setzt die Zeit ueber die Stunden-/Minutenauswahl', async () => {
    const onChange = vi.fn()
    renderWithIntl(<Controlled onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Uhrzeit auswählen' }))
    await userEvent.click(screen.getByRole('option', { name: '19' }))
    await userEvent.click(screen.getByRole('option', { name: '45' }))

    expect(onChange).toHaveBeenLastCalledWith('19:45')
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('19:45')
    // Auswahl schliesst nach der Minute.
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
