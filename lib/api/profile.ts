import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

/** Eigenen Vor- und Nachnamen speichern. */
export async function updateName(name: { firstName: string; lastName: string }): Promise<void> {
  const response = await authenticatedFetch(buildApiUrl('/auth/me/name'), {
    method: 'PUT',
    body: JSON.stringify(name),
  })
  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Speichern des Namens')
  }
}
