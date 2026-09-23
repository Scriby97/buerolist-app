import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'
import type { Category } from './categories'
import type { Note } from './notes'

export type ProjectStatus = 'active' | 'completed'

export interface ProjectCustomerSummary {
  id: string
  name: string
}

export interface Project {
  id: string
  organizationId: string
  customerId: string
  title: string
  status: ProjectStatus
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  customer?: ProjectCustomerSummary
}

export interface ProjectTimeSummaryRow {
  creatorId: string
  creatorFirstName: string | null
  creatorLastName: string | null
  creatorEmail: string | null
  categoryId: string | null
  categoryName: string | null
  totalMinutes: number
}

export interface ProjectDetail {
  project: Project
  categories: Category[]
  notes: Note[]
  timeSummary: ProjectTimeSummaryRow[]
}

export async function getProjects(
  organizationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<Project[]> {
  const url = new URL(buildApiUrl('/projects'))
  url.searchParams.set('organizationId', organizationId)

  const res = await authenticatedFetch(url.toString(), { signal: options.signal })
  if (!res.ok) {
    await throwApiError(res, `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Projekt-Detailansicht inkl. gewählter Kategorien, Notizen+Fotos und der
 * Zeit-Zusammenfassung pro Mitarbeiter/Kategorie.
 */
export async function getProjectDetail(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<ProjectDetail> {
  const res = await authenticatedFetch(buildApiUrl(`/projects/${id}`), {
    signal: options.signal,
  })
  if (!res.ok) {
    await throwApiError(res, `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createProject(data: {
  title: string
  customerId: string
  categoryIds?: string[]
  organizationId?: string
}): Promise<Project> {
  const res = await authenticatedFetch(buildApiUrl('/projects'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Anlegen des Projekts')
  }
  return res.json()
}

export async function updateProject(
  id: string,
  data: { title?: string; status?: ProjectStatus; categoryIds?: string[] },
): Promise<Project> {
  const res = await authenticatedFetch(buildApiUrl(`/projects/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Speichern des Projekts')
  }
  return res.json()
}

export async function deleteProject(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/projects/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Löschen des Projekts')
  }
}
