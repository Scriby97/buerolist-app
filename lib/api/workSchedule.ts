import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'
import type { WorkSchedule } from '@/lib/workSchedule'

/** Eigenen normalen Arbeitstag speichern. */
export async function updateWorkSchedule(schedule: WorkSchedule): Promise<void> {
  const response = await authenticatedFetch(buildApiUrl('/auth/me/work-schedule'), {
    method: 'PUT',
    body: JSON.stringify(schedule),
  })
  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Speichern der Arbeitszeiten')
  }
}
