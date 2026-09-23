import {
  Organization,
  OrganizationMembership,
  OrganizationSubscription,
  SelfServiceOrganizationRequest,
  SelfServiceOrganizationResponse,
  SubscriptionTier,
  UpdateOrganizationSubscriptionResponse,
} from '@/lib/types/user'
import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

/**
 * Get all organizations (Super Admin only)
 */
export async function getAllOrganizations(): Promise<Organization[]> {
  const response = await authenticatedFetch(buildApiUrl('/organizations'))

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Laden der Organisationen')
  }

  return response.json()
}

/**
 * Get all organizations the current user is a member of, including their role.
 */
export async function getMyOrganizations(): Promise<OrganizationMembership[]> {
  const response = await authenticatedFetch(buildApiUrl('/organizations/mine'))

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Laden der Organisationen')
  }

  return response.json()
}

/**
 * Create an organization for the current authenticated user.
 */
export async function createSelfServiceOrganization(
  data: SelfServiceOrganizationRequest
): Promise<SelfServiceOrganizationResponse> {
  const response = await authenticatedFetch(buildApiUrl('/organizations/self-service'), {
    method: 'POST',
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Erstellen der Organisation')
  }

  return response.json()
}

/**
 * Get the current subscription (tier, status, plan limits) of an organization.
 * Any member of the organization may call this.
 */
export async function getOrganizationSubscription(
  organizationId: string
): Promise<OrganizationSubscription> {
  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/subscription`)
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Laden des Abonnements')
  }

  return response.json()
}

/**
 * Change (upgrade/downgrade) or cancel an organization's subscription tier.
 * Owner only. Depending on the transition, the response either contains the
 * updated subscription directly, or a Stripe checkoutUrl to redirect to
 * (upgrade from the free tier, where no Stripe subscription exists yet).
 */
export async function updateOrganizationSubscription(
  organizationId: string,
  tier: SubscriptionTier
): Promise<UpdateOrganizationSubscriptionResponse> {
  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/subscription`),
    {
      method: 'PATCH',
      body: JSON.stringify({ tier }),
    }
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Ändern des Abonnements')
  }

  return response.json()
}

/**
 * Update the current organization's profile (currently just the name).
 * Owner only.
 */
export async function updateOrganizationProfile(
  organizationId: string,
  data: { name?: string }
): Promise<Organization> {
  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/profile`),
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Speichern der Organisation')
  }

  return response.json()
}

/**
 * Upload (or replace) the organization's logo. Owner only.
 * `image` should already be a resized square raster blob (see resizeToSquareWebp).
 */
export async function uploadOrganizationLogo(
  organizationId: string,
  image: Blob
): Promise<Organization> {
  const form = new FormData()
  form.append('file', image, 'logo.webp')

  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/logo`),
    {
      method: 'POST',
      body: form,
    }
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Hochladen des Logos')
  }

  return response.json()
}

/**
 * Remove the organization's logo (falls back to the generated initials avatar).
 * Owner only.
 */
export async function deleteOrganizationLogo(
  organizationId: string
): Promise<Organization> {
  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/logo`),
    { method: 'DELETE' }
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Entfernen des Logos')
  }

  return response.json()
}

/**
 * Create a Stripe Customer Portal session (invoices, payment method, cancel)
 * for self-service billing management. Owner only; only available once the
 * organization has a Stripe customer (i.e. not on the free tier).
 */
export async function createBillingPortalSession(
  organizationId: string
): Promise<{ url: string }> {
  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/billing-portal`),
    { method: 'POST' }
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Öffnen der Rechnungsverwaltung')
  }

  return response.json()
}

/**
 * The owner deletes their own organization (soft delete - members and
 * projects are archived, the organization itself stays visible to global
 * administrators until they hard-delete it). Owner only.
 */
export async function deleteOwnOrganization(organizationId: string): Promise<void> {
  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/self-delete`),
    { method: 'DELETE' }
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Löschen der Organisation')
  }
}

/**
 * Permanently deletes an organization and all its data (Super Admin only).
 * Only allowed once the owner has released the organization for deletion
 * via deleteOwnOrganization.
 */
export async function hardDeleteOrganization(organizationId: string): Promise<void> {
  const response = await authenticatedFetch(
    buildApiUrl(`/organizations/${organizationId}/hard`),
    { method: 'DELETE' }
  )

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim endgültigen Löschen der Organisation')
  }
}
