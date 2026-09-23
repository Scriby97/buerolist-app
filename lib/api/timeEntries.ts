import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

export interface TimeEntryCreator {
  id: string
  firstName?: string
  lastName?: string
  email: string
}

export interface TimeEntryProject {
  id: string
  title: string
  customerId: string
  customerName: string
}

export interface TimeEntryCategory {
  id: string
  name: string
}

export interface TimeEntry {
  id: string
  projectId: string
  categoryId: string | null
  creatorId: string
  startAt: string
  endAt: string
  project: TimeEntryProject
  category: TimeEntryCategory | null
  creator: TimeEntryCreator
}

export interface GetTimeEntriesResponse {
  timeEntries: TimeEntry[]
  // Cursor fuer die naechste Seite; null = keine weiteren Eintraege.
  nextCursor: string | null
}

export interface GetTimeEntriesOptions {
  // Seitengroesse (neueste zuerst). Ohne limit kommen alle Treffer auf einmal.
  limit?: number
  // nextCursor der vorherigen Seite.
  cursor?: string
  // Nur Eintraege eines bestimmten Projekts (Projekt-Detailansicht).
  projectId?: string
  signal?: AbortSignal
}

/**
 * Cursor-paginierte Zeiteinträge (neueste zuerst) - direktes Pendant zu
 * FleetTracks getUsagesWithVehicles. Mit `limit` kommt eine Seite zurück; das
 * `nextCursor` der Antwort wird für den nächsten Aufruf als `cursor`
 * übergeben.
 */
export async function getTimeEntries(
  organizationId?: string,
  options: GetTimeEntriesOptions = {},
): Promise<GetTimeEntriesResponse> {
  const url = new URL(buildApiUrl('/time-entries'))
  if (organizationId) {
    url.searchParams.set('organizationId', organizationId)
  }
  if (options.projectId) {
    url.searchParams.set('projectId', options.projectId)
  }
  if (options.limit) {
    url.searchParams.set('limit', String(options.limit))
  }
  if (options.cursor) {
    url.searchParams.set('cursor', options.cursor)
  }

  const response = await authenticatedFetch(url.toString(), {
    signal: options.signal,
    // Nachladen beim Scrollen soll nicht den globalen Ladeindikator aufblitzen lassen.
    skipLoadingIndicator: Boolean(options.cursor),
  })

  if (!response.ok) {
    await throwApiError(response, `HTTP ${response.status}`)
  }

  const data: GetTimeEntriesResponse = await response.json()
  return { timeEntries: data.timeEntries, nextCursor: data.nextCursor ?? null }
}

export async function createTimeEntry(data: {
  projectId: string
  categoryId?: string
  startAt: string
  endAt: string
}): Promise<TimeEntry> {
  const res = await authenticatedFetch(buildApiUrl('/time-entries'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Speichern des Zeiteintrags')
  }
  return res.json()
}

export async function updateTimeEntry(
  id: string,
  data: { categoryId?: string | null; startAt?: string; endAt?: string },
): Promise<TimeEntry> {
  const res = await authenticatedFetch(buildApiUrl(`/time-entries/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Speichern des Zeiteintrags')
  }
  return res.json()
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/time-entries/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Löschen des Zeiteintrags')
  }
}
