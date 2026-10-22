import { describe, expect, it } from 'vitest'
import { filterCustomers } from './search'

const customers = [
  { id: 'a', name: 'Chalet Müller', number: 1, address: 'Dorfstrasse 1, Gstaad' },
  { id: 'b', name: 'Hotel Alpenblick', number: 12, contactEmail: 'info@alpenblick.ch' },
]

describe('filterCustomers', () => {
  it('findet ueber Name ohne Akzente, Nummer und Adresse', () => {
    expect(filterCustomers(customers, 'muller').map((c) => c.id)).toEqual(['a'])
    expect(filterCustomers(customers, '012').map((c) => c.id)).toEqual(['b'])
    expect(filterCustomers(customers, 'gstaad chalet').map((c) => c.id)).toEqual(['a'])
    expect(filterCustomers(customers, 'alpenblick.ch').map((c) => c.id)).toEqual(['b'])
  })

  it('zeigt bei leerer Suche alle', () => {
    expect(filterCustomers(customers, '  ')).toHaveLength(2)
  })
})
