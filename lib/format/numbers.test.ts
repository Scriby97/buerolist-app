import { describe, expect, it } from 'vitest'
import { formatCustomerNumber, formatPresetNumber, formatProjectNumber, projectDisplayName } from './numbers'

describe('numbers', () => {
  it('formatiert Kunden- und Projektnummern', () => {
    expect(formatCustomerNumber(1)).toBe('001')
    expect(formatCustomerNumber(123)).toBe('123')
    expect(formatProjectNumber(1, 12)).toBe('001-12')
    expect(formatProjectNumber(1, 2)).toBe('001-02')
  })

  it('zeigt fehlende Nummern nicht an', () => {
    expect(formatCustomerNumber(undefined)).toBe('')
    expect(formatProjectNumber(1, undefined)).toBe('')
    expect(projectDisplayName({ title: 'Fassade' }, { name: 'Chalet' })).toBe('Chalet – Fassade')
    expect(projectDisplayName({ title: 'Fassade', number: 3 }, { name: 'Chalet', number: 7 })).toBe(
      '007-03 Chalet – Fassade',
    )
  })
})

describe('formatPresetNumber', () => {
  it('nummeriert Material mit M, Spesen mit S', () => {
    expect(formatPresetNumber('material', 1)).toBe('M-001')
    expect(formatPresetNumber('expense', 12)).toBe('S-012')
  })
})
