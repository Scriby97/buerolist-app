import { getVapidPublicKey, registerPushSubscription } from '@/lib/api/notifications'

export type PushPermissionErrorCode = 'blocked' | 'denied' | 'not-configured'

export class PushPermissionError extends Error {
  code: PushPermissionErrorCode
  constructor(code: PushPermissionErrorCode) {
    super(`push permission error: ${code}`)
    this.code = code
  }
}

export function isPushNotificationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Push-Server erwarten den VAPID Public Key als Uint8Array, Browser liefern ihn
// aber nur als base64url-String - Standard-Konvertierung dafuer.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Fordert bei Bedarf die Browser-Berechtigung an und registriert die
 * Push-Subscription beim Backend. Wirft PushPermissionError mit einem Code,
 * den Aufrufer selbst uebersetzen (siehe settingsReminders.permission*Error) -
 * gemeinsam genutzt von der Erinnerungen-Einstellungsseite und dem
 * Erstanmeldungs-Prompt (NotificationPermissionPrompt).
 */
export async function ensurePushSubscription(): Promise<void> {
  if (Notification.permission === 'denied') {
    throw new PushPermissionError('blocked')
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      throw new PushPermissionError('denied')
    }
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    const publicKey = await getVapidPublicKey()
    if (!publicKey) {
      throw new PushPermissionError('not-configured')
    }
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }

  await registerPushSubscription(subscription.toJSON() as PushSubscriptionJSON)
}
