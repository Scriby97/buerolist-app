import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

export interface EntryReminder {
  id?: string
  userId: string
  enabled: boolean
  reminderTime: string
  timezone: string
  /** Dauer eines Arbeitstags in Minuten (fehlt bei aelteren Backends) */
  workdayMinutes?: number
}

export async function getReminderSettings(): Promise<EntryReminder> {
  const response = await authenticatedFetch(buildApiUrl('/notifications/reminder'))

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Laden der Erinnerung')
  }

  return response.json()
}

export async function updateReminderSettings(
  enabled: boolean,
  time: string,
  workdayMinutes?: number,
): Promise<EntryReminder> {
  const response = await authenticatedFetch(buildApiUrl('/notifications/reminder'), {
    method: 'PUT',
    body: JSON.stringify({ enabled, time, workdayMinutes }),
  })

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Speichern der Erinnerung')
  }

  return response.json()
}

export async function getVapidPublicKey(): Promise<string | null> {
  const response = await authenticatedFetch(buildApiUrl('/notifications/vapid-public-key'))

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Laden des Push-Schlüssels')
  }

  const data = await response.json()
  return data.publicKey ?? null
}

export async function registerPushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  const response = await authenticatedFetch(buildApiUrl('/notifications/push-subscription'), {
    method: 'POST',
    body: JSON.stringify(subscription),
  })

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Registrieren der Push-Benachrichtigungen')
  }
}

export async function unregisterPushSubscription(endpoint: string): Promise<void> {
  const url = new URL(buildApiUrl('/notifications/push-subscription'))
  url.searchParams.set('endpoint', endpoint)

  const response = await authenticatedFetch(url.toString(), { method: 'DELETE' })

  if (!response.ok) {
    await throwApiError(response, 'Fehler beim Entfernen der Push-Benachrichtigungen')
  }
}
