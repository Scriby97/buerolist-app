'use client'

import { useEffect, useState, type FC } from 'react'
import { useTranslations } from 'next-intl'
import { acceptInviteAsExistingUser, declineInviteAsExistingUser } from '@/lib/api/invites'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { useDateLocale } from '@/lib/i18n/formatDate'
import { usePendingInvites } from '@/lib/contexts/PendingInvitesContext'
import type { OrganizationRole } from '@/lib/types/user'

/**
 * Popup, das direkt nach dem Login erscheint, wenn offene Einladungen fuer den
 * User vorliegen. Wird einmal in layout.tsx gerendert und steuert seine
 * Sichtbarkeit selbst ueber den PendingInvitesContext (einmal pro Sitzung/Login,
 * siehe dortige POPUP_SHOWN_KEY-Logik).
 */
export const InvitePopup: FC = () => {
  const t = useTranslations('invitePopup')
  const getApiErrorMessage = useApiErrorMessage()
  const dateLocale = useDateLocale()
  const { refreshOrganizations } = useAuth()

  const ROLE_LABELS: Record<OrganizationRole, string> = {
    employee: t('employeeRole'),
    admin: t('adminRole'),
    owner: t('ownerRole'),
  }
  const {
    pendingInvites,
    hasPendingInvites,
    isLoading,
    removeInvite,
    popupShownThisSession,
    markPopupShown,
  } = usePendingInvites()

  const [dismissed, setDismissed] = useState(false)
  // Einmal eingerastet, sobald das Popup oeffnen durfte - bewusst getrennt von
  // popupShownThisSession aus dem Context: markPopupShown() (unten) setzt
  // dieses Context-Flag sofort auf true, sobald das Popup aufgeht. Wuerde
  // shouldShow direkt von popupShownThisSession abhaengen, wuerde genau dieser
  // Effekt das Popup im selben Zug wieder schliessen, bevor es je sichtbar
  // war (Race zwischen Render und Effekt-Commit) - daher der eigene, nur
  // vorwaerts laufende "opened"-State.
  const [opened, setOpened] = useState(false)
  const [processingToken, setProcessingToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (opened || isLoading || !hasPendingInvites || popupShownThisSession) return
    setOpened(true)
    markPopupShown()
  }, [opened, isLoading, hasPendingInvites, popupShownThisSession, markPopupShown])

  const shouldShow = opened && !dismissed

  // Popup wieder ausblenden, sobald keine offenen Einladungen mehr da sind
  // (z.B. weil die letzte gerade angenommen/abgelehnt wurde).
  useEffect(() => {
    if (!hasPendingInvites) {
      setDismissed(false)
      setOpened(false)
    }
  }, [hasPendingInvites])

  useEffect(() => {
    if (!shouldShow) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDismissed(true)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shouldShow])

  if (!shouldShow) return null

  const handleAccept = async (token: string) => {
    setError(null)
    setProcessingToken(token)
    try {
      await acceptInviteAsExistingUser(token)
      removeInvite(token)
      await refreshOrganizations()
    } catch (err) {
      setError(getApiErrorMessage(err, t('acceptError')))
    } finally {
      setProcessingToken(null)
    }
  }

  const handleDecline = async (token: string) => {
    setError(null)
    setProcessingToken(token)
    try {
      await declineInviteAsExistingUser(token)
      removeInvite(token)
    } catch (err) {
      setError(getApiErrorMessage(err, t('declineError')))
    } finally {
      setProcessingToken(null)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-popup-title"
    >
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h3 id="invite-popup-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            {t('title')}
          </h3>
          <button
            onClick={() => setDismissed(true)}
            aria-label={t('closeButton')}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {pendingInvites.map((invite) => (
            <div
              key={invite.token}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4"
            >
              <div className="font-medium text-zinc-900 dark:text-zinc-50">
                {invite.organization.name}
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {t('roleLabel')} <span className="font-medium">{ROLE_LABELS[invite.role]}</span>
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {t('expiresLabel')} {new Date(invite.expiresAt).toLocaleDateString(dateLocale)}
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAccept(invite.token)}
                  disabled={processingToken === invite.token}
                  className="px-3 py-1.5 bg-brown-600 hover:bg-brown-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingToken === invite.token ? t('accepting') : t('acceptButton')}
                </button>
                <button
                  onClick={() => handleDecline(invite.token)}
                  disabled={processingToken === invite.token}
                  className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('declineButton')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setDismissed(true)}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            {t('laterButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
