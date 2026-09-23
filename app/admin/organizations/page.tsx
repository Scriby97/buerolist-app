'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { getAllOrganizations, hardDeleteOrganization } from '@/lib/api/organizations'
import { Organization, SubscriptionStatus } from '@/lib/types/user'
import { useToast } from '@/lib/hooks/useToast'
import { ToastContainer } from '@/app/components/Toast'
import { useDateLocale } from '@/lib/i18n/formatDate'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'

export default function AdminOrganizationsPage() {
  const { isAdmin, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toasts, showToast, removeToast } = useToast()
  const t = useTranslations('adminOrganizations')
  const tSettings = useTranslations('settings')
  const tBilling = useTranslations('settingsBilling')
  const tTier = useTranslations('subscriptionTiers')
  const dateLocale = useDateLocale()
  const getApiErrorMessage = useApiErrorMessage()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Organization | null>(null)
  const [hardDeleting, setHardDeleting] = useState(false)

  const subscriptionStatusLabel = (status: SubscriptionStatus) => {
    if (status === 'past_due') return tBilling('statusPastDue')
    if (status === 'canceled') return tBilling('statusCanceled')
    return tBilling('statusActive')
  }

  const subscriptionStatusClasses = (status: SubscriptionStatus) => {
    if (status === 'past_due') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    if (status === 'canceled') return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  }

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAllOrganizations()
      setOrganizations(data)
    } catch (error) {
      console.error('Failed to load organizations:', error)
      showToast(t('loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t, showToast])

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
      return
    }

    if (!authLoading && isAdmin) {
      loadOrganizations()
    }
  }, [authLoading, isAdmin, router, loadOrganizations])

  const handleHardDelete = async () => {
    if (!hardDeleteTarget || hardDeleting) return
    setHardDeleting(true)
    try {
      await hardDeleteOrganization(hardDeleteTarget.id)
      setHardDeleteTarget(null)
      showToast(t('hardDeleteSuccess'), 'success')
      await loadOrganizations()
    } catch (error) {
      showToast(getApiErrorMessage(error, t('hardDeleteErrorGeneric')), 'error')
    } finally {
      setHardDeleting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:py-8 space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: tSettings('title'), href: '/settings' },
            { label: t('title') },
          ]}
        />

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>

        {/* Organizations List */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md">
          {/* Desktop Tabelle */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-100 dark:bg-zinc-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('nameHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('subdomainHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('contactEmailHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('statusHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('tierHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('subscriptionStatusHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('periodEndHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('ownerHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('createdHeader')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-300 uppercase tracking-wider">
                    {t('actionsHeader')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-zinc-500 dark:text-zinc-400">
                      {t('noOrgsFound')}
                    </td>
                  </tr>
                ) : (
                  organizations.map(org => (
                    <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                      <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100 font-medium">
                        {org.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {org.subdomain || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {org.contactEmail || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          org.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                        }`}>
                          {org.isActive ? t('activeLabel') : t('inactiveLabel')}
                        </span>
                        {org.deletionRequestedAt && (
                          <span className="block mt-1 px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 whitespace-nowrap">
                            {t('deletedByOwnerLabel', { date: new Date(org.deletionRequestedAt).toLocaleDateString(dateLocale) })}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {org.subscription ? tTier(org.subscription.tier) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {org.subscription ? (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${subscriptionStatusClasses(org.subscription.status)}`}>
                            {subscriptionStatusLabel(org.subscription.status)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {org.subscription?.currentPeriodEnd
                          ? new Date(org.subscription.currentPeriodEnd).toLocaleDateString(dateLocale)
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {org.owner ? (
                          <a href={`mailto:${org.owner.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {org.owner.email}
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {new Date(org.createdAt).toLocaleDateString(dateLocale)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => setHardDeleteTarget(org)}
                          disabled={!org.deletionRequestedAt}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t('hardDeleteButton')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Kacheln */}
          <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-700">
            {organizations.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                {t('noOrgsFound')}
              </div>
            ) : (
              organizations.map(org => (
                <div key={org.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 break-words">
                      {org.name}
                    </p>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                        org.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                      }`}>
                        {org.isActive ? t('activeLabel') : t('inactiveLabel')}
                      </span>
                      {org.deletionRequestedAt && (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 whitespace-nowrap">
                          {t('deletedByOwnerLabel', { date: new Date(org.deletionRequestedAt).toLocaleDateString(dateLocale) })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                    <p><span className="font-medium">{t('subdomainHeader')}:</span> {org.subdomain || '-'}</p>
                    <p className="break-all"><span className="font-medium">{t('contactEmailHeader')}:</span> {org.contactEmail || '-'}</p>
                    <p>
                      <span className="font-medium">{t('tierHeader')}:</span>{' '}
                      <span>{org.subscription ? tTier(org.subscription.tier) : '-'}</span>
                      {org.subscription && (
                        <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded-full ${subscriptionStatusClasses(org.subscription.status)}`}>
                          {subscriptionStatusLabel(org.subscription.status)}
                        </span>
                      )}
                    </p>
                    {org.subscription?.currentPeriodEnd && (
                      <p><span className="font-medium">{t('periodEndHeader')}:</span> {new Date(org.subscription.currentPeriodEnd).toLocaleDateString(dateLocale)}</p>
                    )}
                    <p className="break-all">
                      <span className="font-medium">{t('ownerHeader')}:</span>{' '}
                      {org.owner ? (
                        <a href={`mailto:${org.owner.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                          {org.owner.email}
                        </a>
                      ) : '-'}
                    </p>
                    <p><span className="font-medium">{t('createdLabel')}</span> {new Date(org.createdAt).toLocaleDateString(dateLocale)}</p>
                  </div>
                  {org.deletionRequestedAt && (
                    <button
                      onClick={() => setHardDeleteTarget(org)}
                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700"
                    >
                      {t('hardDeleteButton')}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {hardDeleteTarget && (
        <ConfirmDialog
          title={t('hardDeleteConfirmTitle')}
          message={t('hardDeleteConfirmMessage', { name: hardDeleteTarget.name })}
          confirmLabel={hardDeleting ? t('hardDeleting') : t('hardDeleteConfirmLabel')}
          cancelLabel={t('hardDeleteConfirmCancelLabel')}
          requireTypedConfirmation={hardDeleteTarget.name}
          typedConfirmationLabel={t('hardDeleteConfirmTypedLabel', { name: hardDeleteTarget.name })}
          onConfirm={handleHardDelete}
          onCancel={() => setHardDeleteTarget(null)}
        />
      )}
    </div>
  )
}
