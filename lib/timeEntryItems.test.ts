import { describe, expect, it } from 'vitest'
import { formatChf, parseChfToRappen, parseQuantity, sanitizeDecimalInput } from './format/money'
import { entriesCostTotals, itemsToRows, itemsTotalRappen, rowsToItems, withTrailingEmptyRow } from './timeEntryItems'

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

  it('Menge: max. eine Nachkommastelle', () => {
    expect(parseQuantity('2')).toBe(2)
    expect(parseQuantity('2.5')).toBe(2.5)
    expect(parseQuantity('2.55')).toBeNull()
  })

  it.each([
    ['10.405', 2, '10.40'],
    ['1.55', 1, '1.5'],
    ['abc12', 2, '12'],
    ['1,2,3', 2, '1,23'],
    ['.5', 1, '0.5'],
    ['CHF 10.40', 2, '10.40'],
  ])('sanitizeDecimalInput(%j, %i) = %j', (text, decimals, expected) => {
    expect(sanitizeDecimalInput(text, decimals)).toBe(expected)
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
    // Preis darf fehlen (ohne Preis = 0), ein unlesbarer Preis nicht
    expect(rowsToItems([{ quantity: '1', description: 'Parkieren', price: '' }], 'expense')).toEqual([
      { type: 'expense', quantity: 1, description: 'Parkieren', unitPriceRappen: 0 },
    ])
    expect(rowsToItems([{ quantity: '1', description: 'Parkieren', price: 'abc' }], 'expense')).toBeNull()
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

describe('entriesCostTotals', () => {
  it('summiert Material und Spesen getrennt ueber mehrere Eintraege', () => {
    expect(
      entriesCostTotals([
        { items: [{ id: '1', type: 'material', quantity: 1, description: 'Kitt', unitPriceRappen: 1040 }] },
        {
          items: [
            { id: '2', type: 'material', quantity: 2, description: 'Band', unitPriceRappen: 450 },
            { id: '3', type: 'expense', quantity: 1, description: 'Parkieren', unitPriceRappen: 500 },
          ],
        },
        {},
      ]),
    ).toEqual({ material: 1940, expense: 500 })
  })
})
