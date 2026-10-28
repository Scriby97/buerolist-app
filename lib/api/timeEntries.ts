import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

export interface TimeEntryCreator {
  id: string
  firstName?: string
  lastName?: string
  /** null bei Mitarbeitern ohne Login */
  email: string | null
}

export interface TimeEntryProject {
  id: string
  title: string
  number?: number
  customerId: string
  customerName: string
  customerNumber?: number
}

export interface TimeEntryCategory {
  id: string
  name: string
}

export type TimeEntryItemType = 'material' | 'expense'

/** Material- oder Spesen-Position (Preis in Rappen: CHF 10.40 = 1040) */
export interface TimeEntryItem {
  id: string
  type: TimeEntryItemType
  quantity: number
  description: string
  unitPriceRappen: number
}

export interface TimeEntry {
  id: string
  projectId: string
  categoryId: string | null
  creatorId: string
  startAt: string
  endAt: string
  comment: string | null
  /** Fehlt bei aelteren Backends */
  items?: TimeEntryItem[]
  project: TimeEntryProject
  category: TimeEntryCategory | null
  creator: TimeEntryCreator
  /** Gesetzt, wenn ein Admin/Owner den Eintrag fuer den Mitarbeiter erfasst hat */
  createdBy?: { id: string; firstName?: string; lastName?: string } | null
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
  // Zeitraum (ISO, nur zusammen) fuer die Kalenderansicht - filtert nach startAt.
  startDate?: string
  endDate?: string
  // Nur Eintraege dieser Person (Mitarbeiterauswahl fuer Admin/Owner).
  creatorId?: string
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
  if (options.creatorId) {
    url.searchParams.set('creatorId', options.creatorId)
  }
  if (options.startDate && options.endDate) {
    url.searchParams.set('startDate', options.startDate)
    url.searchParams.set('endDate', options.endDate)
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
  /** Fuer wen erfasst wird (nur Admin/Owner; fehlt = fuer sich selbst) */
  creatorId?: string
  categoryId?: string
  startAt: string
  endAt: string
  comment?: string
  items?: Omit<TimeEntryItem, 'id'>[]
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
  data: {
    categoryId?: string | null
    startAt?: string
    endAt?: string
    comment?: string | null
    items?: Omit<TimeEntryItem, 'id'>[]
  },
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
