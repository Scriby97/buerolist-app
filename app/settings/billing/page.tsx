'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { useDateLocale } from '@/lib/i18n/formatDate'
import {
  createBillingPortalSession,
  getOrganizationSubscription,
  updateOrganizationSubscription,
} from '@/lib/api/organizations'
import type { OrganizationSubscription, SubscriptionTier } from '@/lib/types/user'

interface PlanDefinition {
  id: SubscriptionTier
  label: string
  price: string
  maxProjects: string
  maxMembers: string
  paid: boolean
}

export default function SettingsBillingPage() {
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const { organizations, selectedOrgId, selectedOrganizationRole, isLoading: orgLoading } = useOrganization()
  const t = useTranslations('settingsBilling')
  const tSettings = useTranslations('settings')
  const tTier = useTranslations('subscriptionTiers')
  const getApiErrorMessage = useApiErrorMessage()
  const dateLocale = useDateLocale()

  const isOwner = selectedOrganizationRole === 'owner'
  const organization = organizations.find((org) => org.id === selectedOrgId)

  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [switchingTier, setSwitchingTier] = useState<SubscriptionTier | null>(null)
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  const plans: PlanDefinition[] = [
    { id: 'free', label: tTier('free'), price: t('freeLabel'), maxProjects: '1', maxMembers: '2', paid: false },
    { id: 'pro', label: tTier('pro'), price: `CHF 39.- ${t('perMonthSuffix')}`, maxProjects: t('unlimitedLabel'), maxMembers: t('unlimitedLabel'), paid: true },
  ]

  useEffect(() => {
    if (authLoading || orgLoading) return
    if (!isOwner) {
      router.push('/settings')
    }
  }, [authLoading, orgLoading, isOwner, router])

  const loadSubscription = useCallback(async () => {
    if (!selectedOrgId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getOrganizationSubscription(selectedOrgId)
      setSubscription(data)
    } catch (err) {
      setError(getApiErrorMessage(err, t('loadError')))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId])

  useEffect(() => {
    if (authLoading || orgLoading || !isOwner || !selectedOrgId) return
    void loadSubscription()
  }, [authLoading, orgLoading, isOwner, selectedOrgId, loadSubscription])

  const performSwitch = async (tier: SubscriptionTier) => {
    if (!selectedOrgId) return
    setSwitchingTier(tier)
    setError(null)
    setNotice(null)
    try {
      const result = await updateOrganizationSubscription(selectedOrgId, tier)
      if (result.checkoutUrl) {
        // Externe Weiterleitung zu Stripe Checkout - kein Next.js-Routing
        window.location.href = result.checkoutUrl
        return
      }
      if (tier === 'free') {
        // Kuendigung wirkt erst zum Periodenende (Stripe cancel_at_period_end) -
        // Tier/Status aendern sich hier serverseitig bewusst noch nicht. Ob die
        // Organisation dann tatsaechlich alle Mitgliedschaften verliert, wird
        // beim eigentlichen Downgrade live neu geprueft (siehe downgradeToFree) -
        // der aktuelle overFreeLimit-Wert ist nur eine Momentaufnahme.
        setNotice(subscription?.overFreeLimit ? t('cancelSuccessOverLimitNotice') : t('cancelSuccessNotice'))
      } else {
        setSubscription(result)
        setNotice(t('switchSuccessNotice'))
      }
    } catch (err) {
      setError(getApiErrorMessage(err, t('switchError')))
    } finally {
      setSwitchingTier(null)
    }
  }

  // Upgrade vom kostenlosen Free-Tarif fuehrt ohnehin sofort zu einer
  // externen Stripe-Checkout-Weiterleitung - dafuer braucht es keinen
  // zusaetzlichen Bestaetigungsdialog, der Wechsel geht direkt los.
  const handlePlanClick = (tier: SubscriptionTier) => {
    if (subscription?.tier === 'free' && tier !== 'free') {
      void performSwitch(tier)
    } else {
      setConfirmTier(tier)
    }
  }

  const handleConfirmSwitch = async () => {
    if (!confirmTier) return
    const tier = confirmTier
    setConfirmTier(null)
    await performSwitch(tier)
  }

  const handleManageBilling = async () => {
    if (!selectedOrgId) return
    setPortalLoading(true)
    setError(null)
    try {
      const { url } = await createBillingPortalSession(selectedOrgId)
      window.location.href = url
    } catch (err) {
      setError(getApiErrorMessage(err, t('portalError')))
      setPortalLoading(false)
    }
  }

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isOwner) {
    return null
  }

  const statusLabel = subscription
    ? subscription.status === 'past_due'
      ? t('statusPastDue')
      : subscription.status === 'canceled'
        ? t('statusCanceled')
        : t('statusActive')
    : null

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: tSettings('title'), href: '/settings' },
            { label: t('title') },
          ]}
        />

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t('subtitle', { name: organization?.name ?? '' })}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {notice && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">{notice}</p>
          </div>
        )}

        {subscription?.status === 'past_due' && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">{t('pastDueWarning')}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : subscription ? (
          <>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                {t('currentPlanTitle')}
              </h2>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  {tTier(subscription.tier)}
                </span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{statusLabel}</span>
              </div>
              {subscription.currentPeriodEnd && (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('periodEndLabel')} {new Date(subscription.currentPeriodEnd).toLocaleDateString(dateLocale)}
                </p>
              )}
              {subscription.stripeCustomerId && (
                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="mt-4 px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? t('portalLoading') : t('manageBillingButton')}
                </button>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">{t('choosePlanTitle')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isCurrent = plan.id === subscription.tier
                  const isBusy = switchingTier === plan.id
                  return (
                    <div
                      key={plan.id}
                      className={[
                        'rounded-xl border p-5',
                        isCurrent
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800',
                      ].join(' ')}
                    >
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{plan.label}</h3>
                      <p className="mt-1 text-blue-700 dark:text-blue-300 font-medium">{plan.price}</p>
                      <ul className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                        <li>{plan.maxProjects} {t('projectsSuffix')}</li>
                        <li>{plan.maxMembers} {t('membersSuffix')}</li>
                      </ul>
                      <button
                        type="button"
                        disabled={isCurrent || switchingTier !== null}
                        onClick={() => handlePlanClick(plan.id)}
                        className={[
                          'mt-4 w-full px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                          isCurrent
                            ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                            : plan.paid
                              ? 'bg-brown-600 hover:bg-brown-700 text-white'
                              : 'bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100',
                        ].join(' ')}
                      >
                        {isCurrent
                          ? t('currentPlanBadge')
                          : isBusy
                            ? t('switching')
                            : t('switchButton', { plan: plan.label })}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {confirmTier && (() => {
        // Diese Verzweigung wird aktuell nur fuer die Kuendigung (-> free)
        // erreicht - ein Upgrade vom kostenlosen Tarif laeuft ohne Dialog
        // direkt zu Stripe Checkout (siehe handlePlanClick). Der
        // "isCancel"-Zweig bleibt trotzdem generisch (nicht hart auf zwei
        // Tarife verdrahtet), falls spaeter ein dritter, bezahlter Tarif
        // dazukommt und ein direkter Wechsel zwischen zwei bezahlten
        // Tarifen moeglich wird.
        const isCancel = confirmTier === 'free'
        const overLimit = isCancel && subscription?.overFreeLimit

        return (
          <ConfirmDialog
            title={overLimit ? t('cancelConfirmOverLimitTitle') : isCancel ? t('cancelConfirmTitle') : t('switchConfirmTitle')}
            message={overLimit ? t('cancelConfirmOverLimitMessage') : isCancel ? t('cancelConfirmMessage') : t('switchConfirmMessage')}
            confirmLabel={isCancel ? t('cancelConfirmButton') : t('switchConfirmButton')}
            cancelLabel={t('confirmCancelLabel')}
            onConfirm={handleConfirmSwitch}
            onCancel={() => setConfirmTier(null)}
          />
        )
      })()}
    </div>
  )
}
