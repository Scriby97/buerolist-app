import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

export interface CategoryGroupSummary {
  id: string
  name: string
  /** Nummer der Hauptkategorie (1, 2, 3 ...) */
  number: number
}

export interface Category {
  id: string
  organizationId: string
  name: string
  /** Hauptkategorie (fehlt bei aelteren Backends) */
  groupId?: string
  /** Nummer innerhalb der Hauptkategorie - Anzeige "1.03" */
  number?: number
  group?: CategoryGroupSummary
  createdAt: string
}

/** Hauptkategorie mit ihren Kategorien (nach Nummer sortiert). */
export interface CategoryGroup extends CategoryGroupSummary {
  organizationId: string
  categories: Category[]
  createdAt: string
}

/**
 * Die Kategorien-Bibliothek einer Organisation (z.B. Gerüstbau, Schleifen,
 * Streichen) - für die Kategorien-Auswahl bei der Projekt-Erstellung sowie
 * die Kategorien-Verwaltung in den Einstellungen.
 */
export async function getCategories(
  organizationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<Category[]> {
  const url = new URL(buildApiUrl('/categories'))
  url.searchParams.set('organizationId', organizationId)

  const res = await authenticatedFetch(url.toString(), { signal: options.signal })
  if (!res.ok) {
    await throwApiError(res, `HTTP ${res.status}`)
  }
  return res.json()
}

/** Hauptkategorien inkl. Kategorien, beides nach Nummer sortiert. */
export async function getCategoryGroups(
  organizationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<CategoryGroup[]> {
  const url = new URL(buildApiUrl('/categories/groups'))
  url.searchParams.set('organizationId', organizationId)
  const res = await authenticatedFetch(url.toString(), { signal: options.signal })
  if (!res.ok) {
    await throwApiError(res, `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createCategoryGroup(data: { name: string; organizationId?: string }): Promise<CategoryGroup> {
  const res = await authenticatedFetch(buildApiUrl('/categories/groups'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Anlegen der Hauptkategorie')
  }
  return res.json()
}

export async function updateCategoryGroup(id: string, name: string): Promise<CategoryGroup> {
  const res = await authenticatedFetch(buildApiUrl(`/categories/groups/${id}`), {
    method: 'PUT',
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Speichern der Hauptkategorie')
  }
  return res.json()
}

export async function deleteCategoryGroup(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/categories/groups/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Löschen der Hauptkategorie')
  }
}

export async function createCategory(data: {
  name: string
  groupId: string
  organizationId?: string
}): Promise<Category> {
  const res = await authenticatedFetch(buildApiUrl('/categories'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Anlegen der Kategorie')
  }
  return res.json()
}

/** Umbenennen und/oder in eine andere Hauptkategorie verschieben. */
export async function updateCategory(id: string, data: { name?: string; groupId?: string }): Promise<Category> {
  const res = await authenticatedFetch(buildApiUrl(`/categories/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Speichern der Kategorie')
  }
  return res.json()
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/categories/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Löschen der Kategorie')
  }
}
