import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'
import type { Note } from './notes'

export interface Customer {
  id: string
  organizationId: string
  name: string
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  createdAt: string
  updatedAt: string
}

export interface CustomerProjectSummary {
  id: string
  title: string
  status: 'active' | 'completed'
  createdAt: string
}

export interface CustomerDetail {
  customer: Customer
  projects: CustomerProjectSummary[]
  notes: Note[]
}

export async function getCustomers(
  organizationId: string,
  options: { signal?: AbortSignal } = {},
): Promise<Customer[]> {
  const url = new URL(buildApiUrl('/customers'))
  url.searchParams.set('organizationId', organizationId)

  const res = await authenticatedFetch(url.toString(), { signal: options.signal })
  if (!res.ok) {
    await throwApiError(res, `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Kunden-Detailansicht inkl. Projekt-History und Notizen+Fotos.
 */
export async function getCustomerDetail(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<CustomerDetail> {
  const res = await authenticatedFetch(buildApiUrl(`/customers/${id}`), {
    signal: options.signal,
  })
  if (!res.ok) {
    await throwApiError(res, `HTTP ${res.status}`)
  }
  return res.json()
}

export async function createCustomer(data: {
  name: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  organizationId?: string
}): Promise<Customer> {
  const res = await authenticatedFetch(buildApiUrl('/customers'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Anlegen des Kunden')
  }
  return res.json()
}

export async function updateCustomer(
  id: string,
  data: { name?: string; contactEmail?: string | null; contactPhone?: string | null; address?: string | null },
): Promise<Customer> {
  const res = await authenticatedFetch(buildApiUrl(`/customers/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Speichern des Kunden')
  }
  return res.json()
}

export async function deleteCustomer(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/customers/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Löschen des Kunden')
  }
}
