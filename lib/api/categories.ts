import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

export interface Category {
  id: string
  organizationId: string
  name: string
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

export async function createCategory(data: {
  name: string
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

export async function updateCategory(id: string, name: string): Promise<Category> {
  const res = await authenticatedFetch(buildApiUrl(`/categories/${id}`), {
    method: 'PUT',
    body: JSON.stringify({ name }),
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
