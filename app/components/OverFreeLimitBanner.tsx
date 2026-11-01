'use client'

import { useEffect, useState, type FC } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getOrganizationSubscription } from '@/lib/api/organizations'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import type { OrganizationSubscription } from '@/lib/types/user'

const dismissedKey = (organizationId: string) => `buerolist:overFreeLimitDismissed:${organizationId}`

type LimitKey = 'customers' | 'projects' | 'members'

const LIMIT_FIELDS: { key: LimitKey; limit: 'maxCustomers' | 'maxProjects' | 'maxMembers' }[] = [
  { key: 'customers', limit: 'maxCustomers' },
  { key: 'projects', limit: 'maxProjects' },
  { key: 'members', limit: 'maxMembers' },
]

/** Was im Free-Tarif ueber dem Limit liegt, z.B. [{ key: 'customers', used: 16, max: 15 }]. */
export function exceededFreeLimits(subscription: OrganizationSubscription) {
  if (subscription.tier !== 'free' || !subscription.limits || !subscription.usage) return []
  return LIMIT_FIELDS.flatMap(({ key, limit }) => {
    const max = subscription.limits![limit]
    const used = subscription.usage![key]
    return max !== null && used > max ? [{ key, used, max }] : []
  })
}

/**
 * Hinweis fuer Admins/Owner, wenn die Organisation im Free-Tarif mehr Kunden,
 * aktive Projekte oder Mitarbeiter hat, als erlaubt (z.B. nach einer
 * Senkung der Free-Limits). Bestehende Daten bleiben nutzbar, nur Neues
 * anlegen ist gesperrt. Wie PastDueSubscriptionBanner einmal in layout.tsx
 * gerendert; pro Sitzung wegklickbar.
 */
export const OverFreeLimitBanner: FC = () => {
  const t = useTranslations('overFreeLimitBanner')
  const { selectedOrgId, selectedOrganizationRole, isLoading: orgLoading } = useOrganization()
  const [exceeded, setExceeded] = useState<ReturnType<typeof exceededFreeLimits>>([])
  const [dismissed, setDismissed] = useState(false)

  const isManager = selectedOrganizationRole === 'owner' || selectedOrganizationRole === 'admin'

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset beim Org-Wechsel, s.u.
    setDismissed(false)
    setExceeded([])

    if (orgLoading || !isManager || !selectedOrgId) return

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
        if (!cancelled) setExceeded(exceededFreeLimits(subscription))
      })
      .catch(() => {
        // Kein kritischer Pfad - Banner bleibt einfach aus
      })

    return () => {
      cancelled = true
    }
  }, [orgLoading, isManager, selectedOrgId])

  if (exceeded.length === 0 || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      if (selectedOrgId) window.sessionStorage.setItem(dismissedKey(selectedOrgId), '1')
    } catch {
      // sessionStorage nicht verfuegbar - Dismiss gilt dann nur bis zum naechsten Rendern
    }
  }

  const items = exceeded.map(({ key, used, max }) => t(key, { used, max })).join(', ')

  return (
    <div
      className="print:hidden fixed z-40 top-20 inset-x-4 md:top-4 md:inset-x-auto md:right-4 md:w-96 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/90 shadow-lg p-4"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-amber-800 dark:text-amber-100">{t('message', { items })}</p>
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
