import type { Category, CategoryGroupSummary } from '@/lib/api/categories'

/** "1.03" aus Hauptkategorie 1 und Kategorie 3; '' ohne Nummern. */
export function formatCategoryNumber(groupNumber?: number | null, categoryNumber?: number | null): string {
  return groupNumber && categoryNumber ? `${groupNumber}.${String(categoryNumber).padStart(2, '0')}` : ''
}

/** "1.03 Streichen" bzw. nur der Name, wenn Nummern fehlen. */
export function categoryLabel(category: Pick<Category, 'name' | 'number' | 'group'>): string {
  const number = formatCategoryNumber(category.group?.number, category.number)
  return number ? `${number} ${category.name}` : category.name
}

export interface CategoriesByGroup {
  /** null = Kategorien ohne Hauptkategorie (alte Daten) */
  group: CategoryGroupSummary | null
  categories: Category[]
}

/**
 * Kategorien nach Hauptkategorie gruppieren (fuer Projekt-Ansicht und
 * Auswahllisten) - Gruppen und Kategorien nach Nummer sortiert.
 */
export function groupCategories(categories: Category[]): CategoriesByGroup[] {
  const byGroup = new Map<string, CategoriesByGroup>()
  for (const category of categories) {
    const key = category.group?.id ?? '__none__'
    let entry = byGroup.get(key)
    if (!entry) {
      entry = { group: category.group ?? null, categories: [] }
      byGroup.set(key, entry)
    }
    entry.categories.push(category)
  }
  const groups = [...byGroup.values()]
  for (const entry of groups) {
    entry.categories.sort((a, b) => (a.number ?? 0) - (b.number ?? 0) || a.name.localeCompare(b.name))
  }
  return groups.sort((a, b) => (a.group?.number ?? Infinity) - (b.group?.number ?? Infinity))
}
