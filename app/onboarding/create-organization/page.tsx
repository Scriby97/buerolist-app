'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  createSelfServiceOrganization,
  uploadOrganizationLogo,
} from '@/lib/api/organizations'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import {
  resizeToSquareWebp,
  ImageValidationError,
  blobToDataUrl,
} from '@/lib/images/resizeImage'
import { OrgAvatar } from '@/app/components/OrgAvatar'
import { PENDING_ORG_LOGO_KEY } from '@/lib/organizations/pendingLogo'
import type { SubscriptionTier } from '@/lib/types/user'

interface PlanDefinition {
  id: SubscriptionTier
  label: string
  price: string
  maxProjects: string
  maxMembers: string
  paid: boolean
  highlight?: boolean
}

export default function CreateOrganizationOnboardingPage() {
  const { refreshOrganizations, hasOrganization } = useAuth()
  const searchParams = useSearchParams()
  const wasCanceled = searchParams.get('canceled') === '1'
  const backHref = hasOrganization ? '/settings' : '/onboarding'
  const t = useTranslations('onboardingCreateOrg')
  const tTier = useTranslations('subscriptionTiers')
  const getApiErrorMessage = useApiErrorMessage()

  const plans: PlanDefinition[] = useMemo(() => [
    {
      id: 'free',
      label: tTier('free'),
      price: t('freeLabel'),
      maxProjects: '1',
      maxMembers: '2',
      paid: false,
    },
    {
      id: 'pro',
      label: tTier('pro'),
      price: `CHF 39.- ${t('perMonthSuffix')}`,
      maxProjects: t('unlimitedLabel'),
      maxMembers: t('unlimitedLabel'),
      paid: true,
      highlight: true,
    },
  ], [t, tTier])

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>('free')
  const [organizationName, setOrganizationName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Vorherige Object-URL freigeben, sobald die Vorschau wechselt / die Seite
    // verlassen wird - einzige Stelle, an der revoke() passiert.
    if (!logoPreview) return
    return () => URL.revokeObjectURL(logoPreview)
  }, [logoPreview])

  const handleLogoPicked = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLogoError(null)
    try {
      const blob = await resizeToSquareWebp(file)
      setLogoBlob(blob)
      setLogoPreview(URL.createObjectURL(blob))
    } catch (err) {
      if (err instanceof ImageValidationError) {
        setLogoError(
          err.message === 'unsupported-type'
            ? t('logoInvalidType')
            : err.message === 'too-large'
              ? t('logoTooLarge')
              : t('logoProcessingFailed'),
        )
      } else {
        setLogoError(t('logoProcessingFailed'))
      }
    }
  }

  const clearLogo = () => {
    setLogoBlob(null)
    setLogoError(null)
    setLogoPreview(null)
  }

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlan) ?? plans[0],
    [plans, selectedPlan]
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!organizationName.trim()) {
      setError(t('nameRequiredError'))
      return
    }

    setLoading(true)

    try {
      const trimmedName = organizationName.trim()
      const result = await createSelfServiceOrganization({
        name: trimmedName,
        tier: selectedPlan,
      })

      if (result.checkoutUrl) {
        // Bezahlter Tarif: die Organisation entsteht erst nach erfolgreicher
        // Zahlung im Stripe-Webhook. Das Logo überlebt die Weiterleitung zu
        // Stripe hier im sessionStorage und wird auf der Success-Seite an die
        // dann existierende Organisation hochgeladen.
        if (logoBlob) {
          try {
            const dataUrl = await blobToDataUrl(logoBlob)
            sessionStorage.setItem(
              PENDING_ORG_LOGO_KEY,
              JSON.stringify({ name: trimmedName, dataUrl }),
            )
          } catch {
            // Zwischenspeichern fehlgeschlagen - Logo ist optional, in den
            // Einstellungen nachholbar. Erstellung nicht blockieren.
          }
        }
        // Externe Weiterleitung zu Stripe Checkout - kein Next.js-Routing
        window.location.href = result.checkoutUrl
        return
      }

      // Kostenloser Tarif: Organisation existiert sofort, Logo direkt anhängen.
      if (logoBlob && result.organization) {
        try {
          await uploadOrganizationLogo(result.organization.id, logoBlob)
        } catch {
          // Logo ist optional - Erstellung trotzdem abschliessen.
        }
      }

      await refreshOrganizations()
      window.location.href = '/'
    } catch (err) {
      setError(getApiErrorMessage(err, t('genericError')))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <Link href={backHref} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            {t('backLink')}
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>

        {wasCanceled && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('canceledMessage')}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">{t('planSectionTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.map((plan) => {
                const isSelected = plan.id === selectedPlan
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={[
                      'text-left rounded-xl border p-5 transition-colors',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-700',
                    ].join(' ')}
                  >
                    {plan.highlight && (
                      <span className="inline-flex mb-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-600 text-white">
                        {t('popularBadge')}
                      </span>
                    )}
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{plan.label}</h3>
                    <p className="mt-1 text-blue-700 dark:text-blue-300 font-medium">{plan.price}</p>
                    <ul className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                      <li>{plan.maxProjects} {t('projectsSuffix')}</li>
                      <li>{plan.maxMembers} {t('membersSuffix')}</li>
                    </ul>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t('nameSectionTitle')}</h2>

            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                {t('nameLabel')}
              </label>
              <input
                id="organizationName"
                required
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
                placeholder={t('namePlaceholder')}
              />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t('logoSectionTitle')}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t('logoSectionHint')}</p>
            </div>

            <div className="flex items-center gap-5">
              <OrgAvatar
                name={organizationName || 'Bürolist'}
                logoUrl={logoPreview}
                size={72}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-lg transition-colors"
                >
                  {t('logoChooseButton')}
                </button>
                {logoBlob && (
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    {t('logoRemoveButton')}
                  </button>
                )}
              </div>
            </div>

            {logoError && (
              <p className="text-sm text-red-700 dark:text-red-300">{logoError}</p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleLogoPicked}
            />
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-brown-600 hover:bg-brown-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? t('submitCreating')
              : currentPlan.paid
                ? t('submitPay')
                : t('submitFree')}
          </button>
        </form>
      </div>
    </div>
  )
}
