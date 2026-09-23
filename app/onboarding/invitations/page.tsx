'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getMyInvites, acceptInviteAsExistingUser, declineInviteAsExistingUser } from '@/lib/api/invites'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { useDateLocale } from '@/lib/i18n/formatDate'
import { usePendingInvites } from '@/lib/contexts/PendingInvitesContext'
import type { OrganizationRole, PendingInvite } from '@/lib/types/user'

export default function OnboardingInvitationsPage() {
  const router = useRouter()
  const { refreshOrganizations, hasOrganization } = useAuth()
  const { removeInvite: removePendingInvite } = usePendingInvites()
  const t = useTranslations('onboardingInvitations')
  const getApiErrorMessage = useApiErrorMessage()
  const dateLocale = useDateLocale()

  // Diese Seite wird aus zwei Kontexten erreicht: aus /onboarding (User hat
  // noch keine Organisation) und aus /settings (User hat bereits eine
  // Organisation und schaut sich Einladungen zu WEITEREN Organisationen an).
  // "Zurück" muss dorthin zurückführen, woher man kam - ein hart codiertes
  // /onboarding wuerde im zweiten Fall sofort zu "/" weiterleiten (die
  // Onboarding-Seite selbst leitet Nutzer mit Organisation dorthin um), statt
  // wie erwartet zu den Einstellungen zurueckzukehren.
  const backHref = hasOrganization ? '/settings' : '/onboarding'

  const ROLE_LABELS: Record<OrganizationRole, string> = {
    employee: t('employeeRole'),
    admin: t('adminRole'),
    owner: t('ownerRole'),
  }

  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingToken, setProcessingToken] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getMyInvites()
      .then((data) => {
        if (!cancelled) setInvites(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, t('loadError')))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAccept = async (token: string) => {
    setError(null)
    setProcessingToken(token)
    try {
      await acceptInviteAsExistingUser(token)
      removePendingInvite(token)
      await refreshOrganizations()
      router.push('/')
    } catch (err) {
      setError(getApiErrorMessage(err, t('acceptError')))
      setProcessingToken(null)
    }
  }

  const handleDecline = async (token: string) => {
    setError(null)
    setProcessingToken(token)
    try {
      await declineInviteAsExistingUser(token)
      setInvites((prev) => prev.filter((invite) => invite.token !== token))
      removePendingInvite(token)
    } catch (err) {
      setError(getApiErrorMessage(err, t('declineError')))
    } finally {
      setProcessingToken(null)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 py-10 flex items-center justify-center">
      <div className="max-w-2xl w-full space-y-6">
        <div>
          <Link href={backHref} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('backLink')}
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}

        {!loading && invites.length === 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('noInvitesMessage')}
            </p>
            <Link href={backHref} className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">
              {t('backToOverview')}
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {invites.map((invite) => (
            <div
              key={invite.token}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {invite.organization.name}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t('roleLabel')} <span className="font-medium">{ROLE_LABELS[invite.role]}</span>
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('expiresLabel')} {new Date(invite.expiresAt).toLocaleDateString(dateLocale)}
              </p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleAccept(invite.token)}
                  disabled={processingToken === invite.token}
                  className="px-4 py-2 bg-brown-600 hover:bg-brown-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingToken === invite.token ? t('accepting') : t('acceptButton')}
                </button>
                <button
                  onClick={() => handleDecline(invite.token)}
                  disabled={processingToken === invite.token}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('declineButton')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
