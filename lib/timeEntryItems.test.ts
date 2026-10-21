import { describe, expect, it } from 'vitest'
import { formatChf, parseChfToRappen, parseQuantity } from './format/money'
import { itemsToRows, itemsTotalRappen, rowsToItems, withTrailingEmptyRow } from './timeEntryItems'

describe('money', () => {
  it.each([
    ['10.40', 1040],
    ['10,4', 1040],
    ['10', 1000],
    ['0.05', 5],
  ])('parseChfToRappen(%s) = %i', (text, rappen) => {
    expect(parseChfToRappen(text)).toBe(rappen)
  })

  it('lehnt ungueltige Preise ab', () => {
    expect(parseChfToRappen('')).toBeNull()
    expect(parseChfToRappen('10.405')).toBeNull()
    expect(parseChfToRappen('abc')).toBeNull()
  })

  it('Menge: leer = 1, Komma erlaubt, 0 ungueltig', () => {
    expect(parseQuantity('')).toBe(1)
    expect(parseQuantity('1,5')).toBe(1.5)
    expect(parseQuantity('0')).toBeNull()
  })

  it('formatiert Rappen als CHF', () => {
    expect(formatChf(1040)).toBe('10.40')
  })
})

describe('timeEntryItems', () => {
  it('haengt genau eine leere Zeile an', () => {
    const rows = withTrailingEmptyRow([
      { quantity: '1', description: 'Kitt', price: '10.40' },
      { quantity: '', description: '', price: '' },
      { quantity: '', description: '', price: '' },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual({ quantity: '', description: '', price: '' })
  })

  it('wandelt ausgefuellte Zeilen in Positionen um und ignoriert leere', () => {
    expect(
      rowsToItems(
        [
          { quantity: '', description: ' Patrone Kitt ', price: '10.40' },
          { quantity: '', description: '', price: '' },
        ],
        'material',
      ),
    ).toEqual([{ type: 'material', quantity: 1, description: 'Patrone Kitt', unitPriceRappen: 1040 }])
  })

  it('meldet unvollstaendige Zeilen als ungueltig', () => {
    expect(rowsToItems([{ quantity: '1', description: '', price: '5' }], 'expense')).toBeNull()
    expect(rowsToItems([{ quantity: '1', description: 'Parkieren', price: '' }], 'expense')).toBeNull()
  })

  it('rechnet Menge x Stueckpreis', () => {
    expect(itemsTotalRappen([{ quantity: 3, unitPriceRappen: 1040 }, { quantity: 1.5, unitPriceRappen: 200 }])).toBe(
      3120 + 300,
    )
  })

  it('macht aus bestehenden Positionen eines Typs Eingabezeilen', () => {
    const rows = itemsToRows(
      [
        { id: 'a', type: 'material', quantity: 2, description: 'Kitt', unitPriceRappen: 1040 },
        { id: 'b', type: 'expense', quantity: 1, description: 'Parkieren', unitPriceRappen: 500 },
      ],
      'material',
    )
    expect(rows).toEqual([
      { quantity: '2', description: 'Kitt', price: '10.40' },
      { quantity: '', description: '', price: '' },
    ])
  })
})
