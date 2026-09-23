'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { createInvite, deleteInvite, getOrganizationInvites } from '@/lib/api/invites'
import { getOrganizationMembers, updateMemberRole, transferOwnership, removeMember } from '@/lib/api/organizationMembers'
import { canPromoteToAdmin, canDemoteToEmployee, canTransferOwnership, canRemoveMember } from '@/lib/permissions/organizationMembers'
import type { InviteEntity, InviteStatus, OrganizationMemberDetail } from '@/lib/types/user'
import { useDateLocale } from '@/lib/i18n/formatDate'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'

export default function UsersPage() {
  const router = useRouter()
  const { loading: authLoading, isAdmin, userProfile, refreshOrganizations } = useAuth()
  const { organizations, selectedOrgId, selectedOrganizationRole, isLoading: orgLoading } = useOrganization()
  // Echte Rolle in der gewaehlten Organisation (nicht die globale Administrator-
  // Rolle) - ein globaler Administrator, der dort Admin/Owner ist, darf diese
  // Seite nutzen; ohne Mitgliedschaft verwaltet er Benutzer ueber /admin/all-users.
  const isOrganizationManager = selectedOrganizationRole === 'admin' || selectedOrganizationRole === 'owner'
  const selectedOrganization = organizations.find((org) => org.id === selectedOrgId)
  const t = useTranslations('userManagement')
  const tSettings = useTranslations('settings')
  const tInv = useTranslations('inviteManagement')
  const tMember = useTranslations('memberManagement')
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

  const ORG_ROLE_LABELS: Record<'employee' | 'admin' | 'owner', string> = {
    employee: tInv('employeeOption'),
    admin: tInv('adminOption'),
    owner: tInv('ownerOption'),
  }

  const [activeTab, setActiveTab] = useState<'invites' | 'members'>('members')
  const [invites, setInvites] = useState<InviteEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'employee'>('employee')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [members, setMembers] = useState<OrganizationMemberDetail[]>([])
  const [membersError, setMembersError] = useState<string | null>(null)
  const [memberActionId, setMemberActionId] = useState<string | null>(null)
  const [confirmDemoteMember, setConfirmDemoteMember] = useState<OrganizationMemberDetail | null>(null)
  const [confirmTransferMember, setConfirmTransferMember] = useState<OrganizationMemberDetail | null>(null)
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<OrganizationMemberDetail | null>(null)

  useEffect(() => {
    // Erst entscheiden, wenn sowohl Auth ALS AUCH die Organisationsdaten
    // wirklich fertig geladen sind - die Rolle ist sonst
    // kurzzeitig faelschlich false, waehrend OrganizationContext seine
    // Ableitung (organizationMemberships -> organizations -> selectedOrgId)
    // noch durchlaeuft, was einen berechtigten Owner/Admin faelschlich auf
    // '/' umgeleitet hat (siehe E2E-Testbefund).
    if (authLoading || orgLoading) return

    if (!isOrganizationManager) {
      router.push(isAdmin ? '/admin/all-users' : '/')
    }
  }, [authLoading, orgLoading, isOrganizationManager, isAdmin, router])

  useEffect(() => {
    if (authLoading || orgLoading || !isOrganizationManager) return

    const fetchData = async () => {
      setLoading(true)

      // Diese Seite verwaltet nur Einladungen und Mitglieder der gewaehlten
      // Organisation - die systemweite Benutzerliste gibt es unter /admin/all-users.
      const [inviteResult, memberResult] = await Promise.allSettled([
        getOrganizationInvites(selectedOrgId ?? undefined),
        selectedOrgId ? getOrganizationMembers(selectedOrgId) : Promise.resolve([]),
      ])

      if (inviteResult.status === 'fulfilled') {
        setInvites(inviteResult.value)
      } else {
        setError(getApiErrorMessage(inviteResult.reason, t('loadInvitesError')))
      }

      if (memberResult.status === 'fulfilled') {
        setMembers(memberResult.value)
      } else {
        setMembersError(getApiErrorMessage(memberResult.reason, t('loadMembersError')))
      }

      setLoading(false)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, orgLoading, isOrganizationManager, selectedOrgId])

  const refetchMembers = async () => {
    if (!selectedOrgId) return
    try {
      const result = await getOrganizationMembers(selectedOrgId)
      setMembers(result)
    } catch (err) {
      const message = getApiErrorMessage(err, tMember('loadErrorGeneric'))
      setMembersError(message)
    }
  }

  const getMemberDisplayName = (member: OrganizationMemberDetail) => {
    const name = `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim()
    return name || member.user.email
  }

  const handlePromoteToAdmin = async (member: OrganizationMemberDetail) => {
    setMembersError(null)
    setMemberActionId(member.id)
    try {
      await updateMemberRole(member.organizationId, member.id, 'admin')
      await refetchMembers()
      await refreshOrganizations()
    } catch (err) {
      const message = getApiErrorMessage(err, tMember('promoteErrorGeneric'))
      setMembersError(message)
    } finally {
      setMemberActionId(null)
    }
  }

  const handleDemoteToEmployee = async () => {
    if (!confirmDemoteMember) return
    const member = confirmDemoteMember
    setMembersError(null)
    setMemberActionId(member.id)
    try {
      await updateMemberRole(member.organizationId, member.id, 'employee')
      setConfirmDemoteMember(null)
      await refetchMembers()
      await refreshOrganizations()
    } catch (err) {
      const message = getApiErrorMessage(err, tMember('demoteErrorGeneric'))
      setMembersError(message)
    } finally {
      setMemberActionId(null)
    }
  }

  const handleTransferOwnership = async () => {
    if (!confirmTransferMember) return
    const member = confirmTransferMember
    setMembersError(null)
    setMemberActionId(member.id)
    try {
      await transferOwnership(member.organizationId, member.id)
      setConfirmTransferMember(null)
      await refetchMembers()
      await refreshOrganizations()
    } catch (err) {
      const message = getApiErrorMessage(err, tMember('transferErrorGeneric'))
      setMembersError(message)
    } finally {
      setMemberActionId(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!confirmRemoveMember) return
    const member = confirmRemoveMember
    setMembersError(null)
    setMemberActionId(member.id)
    try {
      await removeMember(member.organizationId, member.id)
      setConfirmRemoveMember(null)
      await refetchMembers()
      await refreshOrganizations()
    } catch (err) {
      const message = getApiErrorMessage(err, tMember('removeErrorGeneric'))
      setMembersError(message)
    } finally {
      setMemberActionId(null)
    }
  }

  const getInviteStatus = (invite: InviteEntity): InviteStatus => {
    if (invite.usedAt) return 'used'
    const expiresAt = new Date(invite.expiresAt).getTime()
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return 'expired'
    return 'pending'
  }

  const handleCreateInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const email = inviteEmail.trim()
    if (!email) {
      setError(tInv('emailRequiredError'))
      return
    }

    setSubmitting(true)
    try {
      const invite = await createInvite({ email, role: inviteRole }, selectedOrgId ?? undefined)
      setInvites((prev) => [invite, ...prev])
      // Der eingeladene User wird die Einladung nach dem naechsten Login
      // automatisch per Popup angezeigt bekommen - kein Link-Handout im
      // Erstellungs-Dialog mehr noetig, Fenster schliesst direkt.
      handleCloseModal()
    } catch (err) {
      const message = getApiErrorMessage(err, tInv('createErrorGeneric'))
      setError(message)
    } finally {
      setSubmitting(false)
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
      setError(message)
    }
  }

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await deleteInvite(inviteId, selectedOrgId ?? undefined)
      setInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
    } catch (err) {
      const message = getApiErrorMessage(err, tInv('deleteErrorGeneric'))
      setError(message)
    }
  }

  const handleCloseModal = () => {
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteRole('employee')
    setError(null)
  }

  const sortedInvites = useMemo(() => {
    return [...invites].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [invites])

  if (authLoading || orgLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isOrganizationManager) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-4 pt-20 pb-24 sm:p-8">
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
              {t('organizationLabel', { name: selectedOrganization?.name ?? '' })}
            </p>
          </div>
          {activeTab === 'invites' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 text-white hover:bg-brown-700 transition-colors"
              >
                {tInv('createButton')}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
              activeTab === 'members'
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-100'
                : 'border-zinc-200 text-zinc-600 hover:border-blue-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-600'
            }`}
          >
            {tMember('tabLabel')}
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

        {activeTab === 'invites' && (
          <>
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{tInv('sectionTitle')}</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{sortedInvites.length}</span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 p-4">
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
                                {status === 'pending' && (
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
                          {status === 'pending' && (
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
            </div>
          </>
        )}

        {activeTab === 'members' && (
          <>
            {membersError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{membersError}</p>
              </div>
            )}

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{tMember('sectionTitle')}</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{members.length}</span>
              </div>

              {/* Desktop Tabelle */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">{tMember('nameHeader')}</th>
                      <th className="px-4 py-3 text-left font-medium">{tMember('emailHeader')}</th>
                      <th className="px-4 py-3 text-left font-medium">{tMember('roleHeader')}</th>
                      <th className="px-4 py-3 text-left font-medium">{tMember('actionsHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
                          {tMember('noMembersFound')}
                        </td>
                      </tr>
                    ) : (
                      members.map((member) => {
                        const isSelf = member.userId === userProfile?.id
                        const isBusy = memberActionId === member.id

                        return (
                          <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                            <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-medium">
                              {getMemberDisplayName(member)}{isSelf && <span className="text-zinc-500 dark:text-zinc-400 font-normal">{tMember('youSuffix')}</span>}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                              {member.user.email}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                              {ORG_ROLE_LABELS[member.role]}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {canPromoteToAdmin(member) && (
                                  <button
                                    onClick={() => handlePromoteToAdmin(member)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brown-600 text-white hover:bg-brown-700 disabled:opacity-50"
                                  >
                                    {isBusy ? tMember('waitingLabel') : tMember('promoteButton')}
                                  </button>
                                )}
                                {canDemoteToEmployee(member, { currentUserRole: selectedOrganizationRole, isSelf }) && (
                                  <button
                                    onClick={() => setConfirmDemoteMember(member)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
                                  >
                                    {tMember('demoteButton')}
                                  </button>
                                )}
                                {canTransferOwnership(member, { currentUserRole: selectedOrganizationRole, isSelf }) && (
                                  <button
                                    onClick={() => setConfirmTransferMember(member)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                                  >
                                    {tMember('transferButton')}
                                  </button>
                                )}
                                {canRemoveMember(member, { currentUserRole: selectedOrganizationRole, isSelf }) && (
                                  <button
                                    onClick={() => setConfirmRemoveMember(member)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    {tMember('removeButton')}
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
                {members.length === 0 ? (
                  <div className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                    {tMember('noMembersFound')}
                  </div>
                ) : (
                  members.map((member) => {
                    const isSelf = member.userId === userProfile?.id
                    const isBusy = memberActionId === member.id

                    return (
                      <div
                        key={member.id}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3"
                      >
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {getMemberDisplayName(member)}{isSelf && <span className="text-zinc-500 dark:text-zinc-400 font-normal">{tMember('youSuffix')}</span>}
                          </p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 break-all">
                            {member.user.email}
                          </p>
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">{tMember('roleHeader')}:</span> {ORG_ROLE_LABELS[member.role]}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {canPromoteToAdmin(member) && (
                            <button
                              onClick={() => handlePromoteToAdmin(member)}
                              disabled={isBusy}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brown-600 text-white hover:bg-brown-700 disabled:opacity-50"
                            >
                              {isBusy ? tMember('waitingLabel') : tMember('promoteButton')}
                            </button>
                          )}
                          {canDemoteToEmployee(member, { currentUserRole: selectedOrganizationRole, isSelf }) && (
                            <button
                              onClick={() => setConfirmDemoteMember(member)}
                              disabled={isBusy}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-50"
                            >
                              {tMember('demoteButton')}
                            </button>
                          )}
                          {canTransferOwnership(member, { currentUserRole: selectedOrganizationRole, isSelf }) && (
                            <button
                              onClick={() => setConfirmTransferMember(member)}
                              disabled={isBusy}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                            >
                              {tMember('transferButton')}
                            </button>
                          )}
                          {canRemoveMember(member, { currentUserRole: selectedOrganizationRole, isSelf }) && (
                            <button
                              onClick={() => setConfirmRemoveMember(member)}
                              disabled={isBusy}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {tMember('removeButton')}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </>
        )}

      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-sm sm:max-w-lg">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {tInv('modalTitle')}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleCreateInvite} className="space-y-4">
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
                    onClick={handleCloseModal}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-60"
                  >
                    {tCommon('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-brown-600 text-white rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-60"
                  >
                    {submitting ? tInv('creatingLabel') : tInv('createSubmitButton')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {confirmDemoteMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {tMember('demoteConfirmTitle')}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tMember('demoteConfirmMessage', { name: getMemberDisplayName(confirmDemoteMember) })}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDemoteMember(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  disabled={memberActionId === confirmDemoteMember.id}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleDemoteToEmployee}
                  className="px-4 py-2 text-sm rounded-lg bg-brown-600 text-white hover:bg-brown-700"
                  disabled={memberActionId === confirmDemoteMember.id}
                >
                  {memberActionId === confirmDemoteMember.id ? tMember('waitingLabel') : tMember('demoteConfirmButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmTransferMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {tMember('transferConfirmTitle')}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tMember('transferConfirmMessage', { name: getMemberDisplayName(confirmTransferMember) })}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmTransferMember(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  disabled={memberActionId === confirmTransferMember.id}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleTransferOwnership}
                  className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                  disabled={memberActionId === confirmTransferMember.id}
                >
                  {memberActionId === confirmTransferMember.id ? tMember('waitingLabel') : tMember('transferConfirmButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmRemoveMember && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {tMember('removeConfirmTitle')}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tMember('removeConfirmMessage', { name: getMemberDisplayName(confirmRemoveMember) })}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmRemoveMember(null)}
                  className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  disabled={memberActionId === confirmRemoveMember.id}
                >
                  {tCommon('cancel')}
                </button>
                <button
                  onClick={handleRemoveMember}
                  className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
                  disabled={memberActionId === confirmRemoveMember.id}
                >
                  {memberActionId === confirmRemoveMember.id ? tMember('waitingLabel') : tMember('removeConfirmButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
