'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createInvite, deleteInvite, getOrganizationInvites } from '@/lib/api/invites'
import { getUsers, sendUserResetPassword } from '@/lib/api/users'
import { getAllOrganizations } from '@/lib/api/organizations'
import type { InviteEntity, InviteStatus, Organization, User } from '@/lib/types/user'
import { useToast } from '@/lib/hooks/useToast'
import { ToastContainer } from '@/app/components/Toast'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { useDateLocale } from '@/lib/i18n/formatDate'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'

export default function AdminAllUsersPage() {
  const router = useRouter()
  const { loading: authLoading, isAdmin } = useAuth()
  const { toasts, showToast, removeToast } = useToast()
  const t = useTranslations('adminAllUsers')
  const tSettings = useTranslations('settings')
  const tInv = useTranslations('inviteManagement')
  const tCommon = useTranslations('common')
  const dateLocale = useDateLocale()
  const getApiErrorMessage = useApiErrorMessage()

  const STATUS_LABELS: Record<InviteStatus, string> = {
    pending: tInv('pendingStatus'),
    used: tInv('usedStatus'),
    expired: tInv('expiredStatus'),
  }

  const STATUS_CLASSES: Record<InviteStatus, string> = {
    pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
    used: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    expired: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  }

  const USER_ROLE_LABELS: Record<User['role'], string> = {
    user: t('roleUser'),
    administrator: t('roleAdministrator'),
  }

  const ORG_ROLE_LABELS: Record<'employee' | 'admin' | 'owner', string> = {
    employee: tInv('employeeOption'),
    admin: tInv('adminOption'),
    owner: tInv('ownerOption'),
  }

  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [confirmUser, setConfirmUser] = useState<User | null>(null)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [invitesLoading, setInvitesLoading] = useState(false)
  const [invitesError, setInvitesError] = useState<string | null>(null)
  const [allInvites, setAllInvites] = useState<InviteEntity[]>([])
  const [inviteOrgId, setInviteOrgId] = useState<string>('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/')
      return
    }

    if (!authLoading && isAdmin) {
      const loadData = async () => {
        try {
          setLoading(true)
          const [orgData, userData] = await Promise.all([
            getAllOrganizations(),
            getUsers(),
          ])
          setOrganizations(orgData)
          setUsers(userData)
        } catch (err) {
          const message = getApiErrorMessage(err, t('loadDataError'))
          setError(message)
        } finally {
          setLoading(false)
        }
      }

      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin, router])

  useEffect(() => {
    if (authLoading || !isAdmin || activeTab !== 'invites') return

    const fetchInvites = async () => {
      try {
        setInvitesLoading(true)
        setInvitesError(null)
        // Als Administrator: liefert der Backend alle Einladungen aller Organisationen,
        // wenn keine organizationId angegeben wird.
        const data = await getOrganizationInvites()
        setAllInvites(Array.isArray(data) ? data : [])
      } catch (err) {
        const message = getApiErrorMessage(err, tInv('loadingInvites'))
        setInvitesError(message)
      } finally {
        setInvitesLoading(false)
      }
    }

    fetchInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, activeTab, isAdmin])

  // /auth/users liefert User-Datensätze mit "organizationMemberships" (ein
  // User kann in mehreren Organisationen Mitglied sein) - die früheren
  // Einzelfelder "organizationId"/"organization" auf User sind vom Backend
  // her immer leer und wurden hier faelschlicherweise noch verwendet, daher
  // liefen Filter und Organisations-Anzeige zuvor ins Leere.
  const orgNameById = useMemo(
    () => new Map(organizations.map((org) => [org.id, org.name])),
    [organizations]
  )

  const getUserOrgSummaries = (user: User) =>
    (user.organizationMemberships ?? []).map((membership) => ({
      id: membership.organizationId,
      name: orgNameById.get(membership.organizationId) ?? membership.organization?.name ?? membership.organizationId,
      roleLabel: ORG_ROLE_LABELS[membership.role],
    }))

  const filteredUsers = useMemo(() => {
    let result = users

    if (selectedOrgId) {
      result = result.filter((user) =>
        (user.organizationMemberships ?? []).some((membership) => membership.organizationId === selectedOrgId)
      )
    }

    const term = searchTerm.trim().toLowerCase()
    if (!term) return result

    return result.filter((user) => {
      const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim().toLowerCase()
      const orgNames = (user.organizationMemberships ?? [])
        .map((membership) => orgNameById.get(membership.organizationId) ?? '')
        .join(' ')
        .toLowerCase()
      return (
        user.email.toLowerCase().includes(term) ||
        name.includes(term) ||
        user.role.toLowerCase().includes(term) ||
        orgNames.includes(term)
      )
    })
  }, [searchTerm, selectedOrgId, users, orgNameById])

  const getDisplayName = (user: User) => {
    const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    return name || user.email
  }

  const getInviteStatus = (invite: InviteEntity): InviteStatus => {
    if (invite.usedAt) return 'used'
    const expiresAt = new Date(invite.expiresAt).getTime()
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return 'expired'
    return 'pending'
  }

  const sortedInvites = useMemo(() => {
    const filtered = inviteOrgId
      ? allInvites.filter((i) => String(i.organizationId) === String(inviteOrgId))
      : allInvites
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [allInvites, inviteOrgId])

  const handleCreateInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setInvitesError(null)

    if (!inviteOrgId) {
      setInvitesError(tInv('selectOrgFirstError'))
      return
    }

    const email = inviteEmail.trim()
    if (!email) {
      setInvitesError(tInv('emailRequiredError'))
      return
    }

    setInviteSubmitting(true)
    try {
      const invite = await createInvite({ email, role: inviteRole }, inviteOrgId)
      // prepend to local cache of invites (server returns invites for all orgs to administrators)
      setAllInvites((prev) => [invite, ...prev])
      // Der eingeladene User wird die Einladung nach dem naechsten Login
      // automatisch per Popup angezeigt bekommen - kein Link-Handout im
      // Erstellungs-Dialog mehr noetig, Fenster schliesst direkt.
      setInviteEmail('')
      setInviteRole('employee')
      setShowInviteModal(false)
      showToast(tInv('createSuccess'), 'success')
    } catch (err) {
      const message = getApiErrorMessage(err, tInv('createErrorGeneric'))
      setInvitesError(message)
      showToast(message, 'error')
    } finally {
      setInviteSubmitting(false)
    }
  }

  const handleShareApp = async () => {
    const url = 'https://buerolist-frontend.vercel.app'
    if (navigator.share) {
      try {
        await navigator.share({ url, title: 'Bürolist' })
      } catch {
        // Nutzer hat den Teilen-Dialog abgebrochen - kein Fehlerfall
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId('share-app-url')
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      const message = getApiErrorMessage(err, tInv('copyErrorGeneric'))
      setInvitesError(message)
    }
  }

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteInvite(inviteId, inviteOrgId)
      setAllInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
    } catch (err) {
      const message = getApiErrorMessage(err, tInv('deleteErrorGeneric'))
      setInvitesError(message)
    }
  }

  const handleCloseInviteModal = () => {
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteRole('employee')
    setInvitesError(null)
  }

  const handleResetRequest = (user: User) => {
    setConfirmUser(user)
  }

  const handleConfirmReset = async () => {
    if (!confirmUser) return

    setSubmittingId(confirmUser.id)
    try {
      await sendUserResetPassword(confirmUser.id)
      showToast(t('resetSuccessToast', { email: confirmUser.email }), 'success')
      setConfirmUser(null)
    } catch (err) {
      const message = getApiErrorMessage(err, t('resetErrorGeneric'))
      showToast(message, 'error')
    } finally {
      setSubmittingId(null)
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pt-20 pb-24 sm:p-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-6xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: tSettings('title'), href: '/settings' },
            { label: t('title') },
          ]}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
              {t('title')}
            </h1>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
              {t('subtitle')}
            </p>
          </div>
          {activeTab === 'invites' && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 text-white hover:bg-brown-700 transition-colors"
            >
              {tInv('createButton')}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
              activeTab === 'users'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-100'
                : 'border-zinc-200 text-zinc-600 hover:border-blue-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-600'
            }`}
          >
            {t('usersTabLabel')}
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
              activeTab === 'invites'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-100'
                : 'border-zinc-200 text-zinc-600 hover:border-blue-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-600'
            }`}
          >
            {tInv('tabLabel')}
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('usersTabLabel')}</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{filteredUsers.length}</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={selectedOrgId}
                  onChange={(event) => setSelectedOrgId(event.target.value)}
                  className="w-full sm:w-56 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100"
                >
                  <option value="">{tInv('allOrganizationsOption')}</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="w-full sm:w-64 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Desktop Tabelle */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t('nameHeader')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('emailHeader')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('roleHeader')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('organizationHeader')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('actionsHeader')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                        {t('noUsersFound')}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-medium">
                          {getDisplayName(user)}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {USER_ROLE_LABELS[user.role]}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {(() => {
                            const orgSummaries = getUserOrgSummaries(user)
                            if (orgSummaries.length === 0) return '-'
                            return (
                              <ul className="space-y-0.5">
                                {orgSummaries.map((org) => (
                                  <li key={org.id}>
                                    {org.name} <span className="text-xs text-zinc-400 dark:text-zinc-500">({org.roleLabel})</span>
                                  </li>
                                ))}
                              </ul>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleResetRequest(user)}
                            className="px-3 py-2 text-xs font-semibold rounded-lg bg-brown-600 text-white hover:bg-brown-700 transition-colors"
                            disabled={submittingId === user.id}
                          >
                            {submittingId === user.id ? t('sendingLabel') : t('resetPasswordButton')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Kacheln */}
            <div className="md:hidden space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                  {t('noUsersFound')}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3"
                  >
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {getDisplayName(user)}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 break-all">
                        {user.email}
                      </p>
                    </div>
                    <div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                      <p>
                        <span className="font-medium">{t('roleHeader')}:</span> {USER_ROLE_LABELS[user.role]}
                      </p>
                      <p>
                        <span className="font-medium">{t('organizationLabel')}</span>{' '}
                        {(() => {
                          const orgSummaries = getUserOrgSummaries(user)
                          if (orgSummaries.length === 0) return '-'
                          return orgSummaries.map((org) => `${org.name} (${org.roleLabel})`).join(', ')
                        })()}
                      </p>
                    </div>
                    <div className="pt-1">
                      <button
                        onClick={() => handleResetRequest(user)}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-brown-600 text-white hover:bg-brown-700 transition-colors"
                        disabled={submittingId === user.id}
                      >
                        {submittingId === user.id ? t('sendingLabel') : t('resetPasswordButton')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'invites' && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{tInv('sectionTitle')}</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{sortedInvites.length}</span>
              </div>
              <select
                value={inviteOrgId}
                onChange={(event) => setInviteOrgId(event.target.value)}
                className="w-full sm:w-64 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100"
              >
                <option value="">{tInv('allOrganizationsOption')}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{tInv('inviteInfoBanner')}</p>
              <button
                onClick={handleShareApp}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 text-white hover:bg-brown-700 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {copiedId === 'share-app-url' ? tInv('copiedLabel') : tInv('shareAppButton')}
              </button>
            </div>

            {invitesError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{invitesError}</p>
              </div>
            )}

            {invitesLoading ? (
              <div className="py-8 text-center text-zinc-500 dark:text-zinc-400">{tInv('loadingInvites')}</div>
            ) : (
              <>
                {/* Desktop Tabelle */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">{tInv('emailHeader')}</th>
                        <th className="px-4 py-3 text-left font-medium">{tInv('roleHeader')}</th>
                        <th className="px-4 py-3 text-left font-medium">{tInv('statusHeader')}</th>
                        <th className="px-4 py-3 text-left font-medium">{tInv('expiryHeader')}</th>
                        <th className="px-4 py-3 text-left font-medium">{tInv('actionsHeader')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                      {sortedInvites.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                            {tInv('noInvitesFound')}
                          </td>
                        </tr>
                      ) : (
                        sortedInvites.map((invite) => {
                          const status = getInviteStatus(invite)

                          return (
                            <tr key={invite.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                              <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-medium">
                                {invite.email}
                              </td>
                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                {ORG_ROLE_LABELS[invite.role]}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_CLASSES[status]}`}>
                                  {STATUS_LABELS[status]}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                {new Date(invite.expiresAt).toLocaleDateString(dateLocale)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-2">
                                      {(status === 'pending' || status === 'used') && (
                                        <button
                                          onClick={() => handleDeleteInvite(invite.id)}
                                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                                        >
                                          {tInv('deleteButton')}
                                        </button>
                                      )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Kacheln */}
                <div className="md:hidden space-y-3">
                  {sortedInvites.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                      {tInv('noInvitesFound')}
                    </div>
                  ) : (
                    sortedInvites.map((invite) => {
                      const status = getInviteStatus(invite)

                      return (
                        <div
                          key={invite.id}
                          className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {invite.email}
                              </p>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                {tInv('roleColumnLabel')} {ORG_ROLE_LABELS[invite.role]}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${STATUS_CLASSES[status]}`}>
                              {STATUS_LABELS[status]}
                            </span>
                          </div>
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <span className="font-medium">{tInv('expiryColumnLabel')}</span> {new Date(invite.expiresAt).toLocaleDateString(dateLocale)}
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {(status === 'pending' || status === 'used') && (
                              <button
                                onClick={() => handleDeleteInvite(invite.id)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                              >
                                {tInv('deleteButton')}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {confirmUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t('resetConfirmTitle')}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('resetConfirmMessage', { email: confirmUser.email })}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmUser(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  disabled={submittingId === confirmUser.id}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="px-4 py-2 text-sm rounded-lg bg-brown-600 text-white hover:bg-brown-700"
                  disabled={submittingId === confirmUser.id}
                >
                  {submittingId === confirmUser.id ? t('sendingLabel') : t('resetPasswordButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {tInv('modalTitle')}
              </h2>
              <button
                onClick={handleCloseInviteModal}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {tInv('organizationLabel')}
                  </label>
                  <select
                    value={inviteOrgId}
                    onChange={(event) => setInviteOrgId(event.target.value)}
                    required
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-zinc-100"
                  >
                    <option value="">{tInv('pleaseSelectOrgOption')}</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {tInv('emailLabel')}
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {tInv('roleLabel')}
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as 'admin' | 'employee')}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg dark:bg-zinc-700 dark:text-zinc-100"
                  >
                    <option value="employee">{tInv('employeeOption')}</option>
                    <option value="admin">{tInv('adminOption')}</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCloseInviteModal}
                    disabled={inviteSubmitting}
                    className="flex-1 px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-60"
                  >
                    {tCommon('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={inviteSubmitting}
                    className="flex-1 px-4 py-2 bg-brown-600 text-white rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-60"
                  >
                    {inviteSubmitting ? tInv('creatingLabel') : tInv('createSubmitButton')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
