'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { usePendingInvites } from '@/lib/contexts/PendingInvitesContext'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import type { ReactNode } from 'react'

// Einheitlicher Linien-Icon-Stil fuer alle Settings-Karten (Umschlag-Icon der
// Einladungen-Karte als Vorlage) - jede Karte uebergibt nur ihre eigenen
// SVG-Formen, Grösse/Farbe/Strichstil bleiben so garantiert konsistent.
function SettingsIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="w-7 h-7 text-blue-600 dark:text-blue-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { supabaseUser, loading: authLoading, isAdmin } = useAuth()
  const { selectedOrganizationRole } = useOrganization()
  // Echte Rolle in der gewaehlten Organisation - ein globaler Administrator, der
  // dort Admin/Owner ist, verwaltet deren Mitglieder genauso wie jeder andere.
  const isOrganizationManager = selectedOrganizationRole === 'admin' || selectedOrganizationRole === 'owner'
  const { pendingInvites, hasPendingInvites } = usePendingInvites()
  const t = useTranslations('settings')

  useEffect(() => {
    if (!authLoading && !supabaseUser) {
      router.push('/login')
    }
  }, [authLoading, supabaseUser, router])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: t('title') }]} />

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </p>
        </div>

        {/* Persoenlich: alles rund um den eigenen Account, unabhaengig von der Rolle */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('personalSectionTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/settings/account"
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
            >
              <SettingsIcon>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
              </SettingsIcon>
              <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('accountTitle')}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t('accountDescription')}
              </p>
            </Link>

            <Link
              href="/settings/appearance"
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
            >
              <SettingsIcon>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </SettingsIcon>
              <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('appearanceTitle')}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t('appearanceDescription')}
              </p>
            </Link>

            <Link
              href="/onboarding/invitations"
              className="relative rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
            >
              {hasPendingInvites && (
                <span className="absolute top-3 right-3 min-w-[20px] h-[20px] px-1.5 flex items-center justify-center rounded-full bg-yellow-400 text-zinc-900 text-xs font-semibold leading-none">
                  {pendingInvites.length}
                </span>
              )}
              <SettingsIcon>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </SettingsIcon>
              <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('invitationsTitle')}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t('invitationsDescription')}
              </p>
            </Link>
          </div>
        </div>

        {/* Organisation: Mitgliederverwaltung der aktuell ausgewaehlten Organisation + neue Organisation gruenden */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('organizationSectionTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {selectedOrganizationRole === 'owner' && (
              <Link
                href="/settings/organization"
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
              >
                <SettingsIcon>
                  <rect x="4" y="3" width="16" height="18" rx="1" />
                  <circle cx="12" cy="9" r="2" />
                  <path d="M8 17c0-2.2 1.8-4 4-4s4 1.8 4 4" />
                </SettingsIcon>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('organizationProfileTitle')}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('organizationProfileDescription')}
                </p>
              </Link>
            )}

            {isOrganizationManager && (
              <Link
                href="/settings/categories"
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
              >
                <SettingsIcon>
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </SettingsIcon>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('categoriesTitle')}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('categoriesDescription')}
                </p>
              </Link>
            )}

            {isOrganizationManager && (
              <Link
                href="/admin/users"
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
              >
                <SettingsIcon>
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M2 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
                  <path d="M15.5 4.2a3.5 3.5 0 0 1 0 6.8" />
                  <path d="M17.5 13.8c2.3.7 4 2.9 4 5.7" />
                </SettingsIcon>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('userManagementTitle')}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('userManagementDescription')}
                </p>
              </Link>
            )}

            {selectedOrganizationRole === 'owner' && (
              <Link
                href="/settings/billing"
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
              >
                <SettingsIcon>
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </SettingsIcon>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('billingTitle')}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('billingDescription')}
                </p>
              </Link>
            )}

            <Link
              href="/onboarding/create-organization"
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
            >
              <SettingsIcon>
                <rect x="4" y="3" width="16" height="18" rx="1" />
                <path d="M9 21v-4h6v4" />
                <path d="M8 7h2M14 7h2M8 12h2M14 12h2" />
              </SettingsIcon>
              <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('createOrgTitle')}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t('createOrgDescription')}
              </p>
            </Link>
          </div>
        </div>

        {/* Administration: nur fuer globale Administratoren, daher bewusst zuunterst */}
        {isAdmin && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('adminSectionTitle')}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/admin/all-users"
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
              >
                <SettingsIcon>
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <circle cx="8" cy="12" r="2" />
                  <path d="M13 10h6M13 14h4" />
                </SettingsIcon>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('allUsersTitle')}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('allUsersDescription')}
                </p>
              </Link>

              <Link
                href="/admin/organizations"
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
              >
                <SettingsIcon>
                  <path d="M3 10l9-6 9 6" />
                  <path d="M5 10v11M9 10v11M15 10v11M19 10v11" />
                  <path d="M3 21h18" />
                </SettingsIcon>
                <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('organizationsTitle')}</div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {t('organizationsDescription')}
                </p>
              </Link>
            </div>
          </div>
        )}

        {/* Info: rechtliche Angaben, fuer alle sichtbar */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('infoSectionTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/impressum"
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 shadow-sm transition-colors hover:border-blue-300 dark:hover:border-blue-600"
            >
              <SettingsIcon>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </SettingsIcon>
              <div className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('impressumTitle')}</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t('impressumDescription')}
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
