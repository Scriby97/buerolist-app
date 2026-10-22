import { describe, expect, it } from 'vitest'
import type { Category } from '@/lib/api/categories'
import { categoryLabel, formatCategoryNumber, groupCategories } from './categories'

const cat = (id: string, name: string, number: number, group?: { id: string; name: string; number: number }) =>
  ({ id, name, number, group, groupId: group?.id, organizationId: 'o', createdAt: '' }) as Category

const maler = { id: 'g1', name: 'Malerarbeiten', number: 1 }
const boden = { id: 'g2', name: 'Bodenbelagsarbeiten', number: 2 }

describe('categories', () => {
  it('formatiert Nummern als Hauptkategorie.Kategorie', () => {
    expect(formatCategoryNumber(1, 3)).toBe('1.03')
    expect(formatCategoryNumber(12, 10)).toBe('12.10')
    expect(formatCategoryNumber(undefined, 3)).toBe('')
    expect(categoryLabel(cat('a', 'Streichen', 3, maler))).toBe('1.03 Streichen')
    expect(categoryLabel(cat('a', 'Streichen', 3))).toBe('Streichen')
  })

  it('gruppiert nach Hauptkategorie, beides nach Nummer sortiert', () => {
    const grouped = groupCategories([
      cat('c', 'Parkett', 1, boden),
      cat('b', 'Streichen', 2, maler),
      cat('a', 'Abdecken', 1, maler),
    ])
    expect(grouped.map((g) => g.group?.name)).toEqual(['Malerarbeiten', 'Bodenbelagsarbeiten'])
    expect(grouped[0].categories.map((c) => c.name)).toEqual(['Abdecken', 'Streichen'])
  })
})
