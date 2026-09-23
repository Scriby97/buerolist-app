'use client'

import { useEffect, useState, type FC } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getOrganizationSubscription } from '@/lib/api/organizations'
import { useOrganization } from '@/lib/contexts/OrganizationContext'

const dismissedKey = (organizationId: string) => `buerolist:pastDueDismissed:${organizationId}`

/**
 * Proaktiver Hinweis fuer den Owner, wenn die Zahlung der aktuell
 * ausgewaehlten Organisation fehlgeschlagen ist (subscription.status ===
 * 'past_due'). Bisher war das nur auf der Abo-Seite selbst sichtbar - ohne
 * echten E-Mail-Versand (separates, spaeteres Thema) ist das sonst leicht zu
 * verpassen. Wird einmal in layout.tsx gerendert, wie InvitePopup.tsx, und
 * steuert seine Sichtbarkeit selbst.
 */
export const PastDueSubscriptionBanner: FC = () => {
  const t = useTranslations('pastDueBanner')
  const { selectedOrgId, selectedOrganizationRole, isLoading: orgLoading } = useOrganization()
  const [isPastDue, setIsPastDue] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isOwner = selectedOrganizationRole === 'owner'

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset beim Org-Wechsel, s.u.
    setDismissed(false)
    setIsPastDue(false)

    if (orgLoading || !isOwner || !selectedOrgId) return

    try {
      if (window.sessionStorage.getItem(dismissedKey(selectedOrgId)) === '1') {
        setDismissed(true)
      }
    } catch {
      // sessionStorage nicht verfuegbar - Banner bleibt einfach anzeigbar
    }

    let cancelled = false
    getOrganizationSubscription(selectedOrgId)
      .then((subscription) => {
        if (!cancelled) setIsPastDue(subscription.status === 'past_due')
      })
      .catch(() => {
        // Fehlschlag hier ist kein kritischer Pfad - Banner bleibt einfach aus
      })

    return () => {
      cancelled = true
    }
  }, [orgLoading, isOwner, selectedOrgId])

  if (!isPastDue || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      if (selectedOrgId) window.sessionStorage.setItem(dismissedKey(selectedOrgId), '1')
    } catch {
      // sessionStorage nicht verfuegbar - Dismiss gilt dann nur bis zum naechsten Rendern
    }
  }

  return (
    <div
      className="fixed z-40 top-20 inset-x-4 md:top-4 md:inset-x-auto md:right-4 md:w-96 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/90 shadow-lg p-4"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-amber-800 dark:text-amber-100">{t('message')}</p>
        <button
          onClick={handleDismiss}
          aria-label={t('dismissLabel')}
          className="shrink-0 text-amber-500 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-100 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <Link
        href="/settings/billing"
        className="mt-2 inline-block text-sm font-medium text-amber-900 dark:text-amber-50 hover:underline"
      >
        {t('actionLabel')}
      </Link>
    </div>
  )
}
