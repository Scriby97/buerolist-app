import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

/** Abwesenheitsgrund der Organisation (z.B. Krankheit, Militär/Zivilschutz). */
export interface AbsenceReason {
  id: string
  organizationId: string
  name: string
  sortOrder: number
}

interface AbsencePerson {
  id: string
  firstName?: string
  lastName?: string
  email?: string | null
  isPlaceholder?: boolean
}

/** Abwesenheit einer Person an einem Kalendertag (keine Projektzeit). */
export interface Absence {
  id: string
  organizationId: string
  creatorId: string
  /** Kalendertag "YYYY-MM-DD" */
  date: string
  minutes: number
  comment: string | null
  reason: { id: string; name: string }
  creator: AbsencePerson
  /** Wer erfasst hat, falls nicht die Person selbst (Admin/Owner) */
  createdBy: AbsencePerson | null
}

/** Ganzer Tag (persönlicher Arbeitstag), halber Tag oder freie Stunden */
export type AbsencePortion = 'full' | 'half' | 'hours'

export async function getAbsenceReasons(organizationId: string): Promise<AbsenceReason[]> {
  const url = new URL(buildApiUrl('/absence-reasons'))
  url.searchParams.set('organizationId', organizationId)
  const res = await authenticatedFetch(url.toString())
  if (!res.ok) await throwApiError(res, 'Fehler beim Laden der Abwesenheitsgründe')
  return res.json()
}

export async function createAbsenceReason(data: { organizationId: string; name: string }): Promise<AbsenceReason> {
  const res = await authenticatedFetch(buildApiUrl('/absence-reasons'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Fehler beim Speichern des Abwesenheitsgrunds')
  return res.json()
}

export async function updateAbsenceReason(id: string, data: { name: string }): Promise<AbsenceReason> {
  const res = await authenticatedFetch(buildApiUrl(`/absence-reasons/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Fehler beim Speichern des Abwesenheitsgrunds')
  return res.json()
}

export async function deleteAbsenceReason(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/absence-reasons/${id}`), { method: 'DELETE' })
  if (!res.ok) await throwApiError(res, 'Fehler beim Löschen des Abwesenheitsgrunds')
}

export async function getAbsences(
  organizationId: string,
  options: { from?: string; to?: string; creatorId?: string; signal?: AbortSignal } = {},
): Promise<Absence[]> {
  const url = new URL(buildApiUrl('/absences'))
  url.searchParams.set('organizationId', organizationId)
  if (options.from) url.searchParams.set('from', options.from)
  if (options.to) url.searchParams.set('to', options.to)
  if (options.creatorId) url.searchParams.set('creatorId', options.creatorId)
  const res = await authenticatedFetch(url.toString(), { signal: options.signal })
  if (!res.ok) await throwApiError(res, 'Fehler beim Laden der Abwesenheiten')
  return res.json()
}

export async function createAbsences(data: {
  organizationId: string
  reasonId: string
  from: string
  to?: string
  portion: AbsencePortion
  minutes?: number
  comment?: string
  creatorId?: string
  creatorIds?: string[]
}): Promise<Absence[]> {
  const res = await authenticatedFetch(buildApiUrl('/absences'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Fehler beim Speichern der Abwesenheit')
  return res.json()
}

export async function updateAbsence(
  id: string,
  data: { reasonId?: string; date?: string; minutes?: number; comment?: string | null },
): Promise<Absence> {
  const res = await authenticatedFetch(buildApiUrl(`/absences/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Fehler beim Speichern der Abwesenheit')
  return res.json()
}

export async function deleteAbsence(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/absences/${id}`), { method: 'DELETE' })
  if (!res.ok) await throwApiError(res, 'Fehler beim Löschen der Abwesenheit')
}
