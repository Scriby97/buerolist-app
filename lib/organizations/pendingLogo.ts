// Zwischenspeicher für ein beim Erstellen einer BEZAHLTEN Organisation
// gewähltes Logo: Die Organisation entsteht erst nach erfolgreicher Stripe-
// Zahlung im Webhook, daher überlebt das (bereits verkleinerte) Logo die
// Weiterleitung zu Stripe hier im sessionStorage und wird auf der Success-
// Seite an die dann existierende Organisation hochgeladen.
export const PENDING_ORG_LOGO_KEY = 'buerolist:pendingOrgLogo'

export interface PendingOrgLogo {
  name: string
  dataUrl: string
}

export function readPendingOrgLogo(): PendingOrgLogo | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORG_LOGO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingOrgLogo
    if (
      parsed &&
      typeof parsed.name === 'string' &&
      typeof parsed.dataUrl === 'string'
    ) {
      return parsed
    }
  } catch {
    // sessionStorage nicht verfügbar / ungültiger Inhalt
  }
  return null
}

export function clearPendingOrgLogo(): void {
  try {
    sessionStorage.removeItem(PENDING_ORG_LOGO_KEY)
  } catch {
    // ignore
  }
}
