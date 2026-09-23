'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { usePendingInvites } from '@/lib/contexts/PendingInvitesContext'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { FC } from 'react'

const UserMenu: FC = () => {
  const { supabaseUser, userProfile, isAdmin, userRole } = useAuth()
  const { selectedOrganizationRole } = useOrganization()
  const { pendingInvites, hasPendingInvites } = usePendingInvites()
  const router = useRouter()
  const t = useTranslations('userMenu')

  if (!supabaseUser) return null

  const displayName = userProfile?.firstName && userProfile?.lastName
    ? `${userProfile.firstName} ${userProfile.lastName}`
    : userProfile?.name || supabaseUser.user_metadata?.fullName || supabaseUser.email

  const getRoleDisplay = () => {
    if (isAdmin) return t('roleAdministrator')
    // Globale Rolle ist nur "Benutzer" - die eigentlich relevante Rolle ist die
    // in der aktuell ausgewählten Organisation (owner/admin/employee).
    if (selectedOrganizationRole === 'owner') return t('roleOwner')
    if (selectedOrganizationRole === 'admin') return t('roleAdmin')
    if (selectedOrganizationRole === 'employee') return t('roleEmployee')
    return t('roleUser')
  }

  return (
    <div className="space-y-3">
      {/* User Info */}
      <div className="text-sm">
        <div className="font-medium text-zinc-900 dark:text-zinc-50">
          {displayName}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {supabaseUser.email}
        </div>
        {userRole && (
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
            {getRoleDisplay()}
          </div>
        )}
      </div>

      {/* Einstellungen (buendelt Account, Ansicht inkl. Sprache, User Management, Organizations je nach Rolle) */}
      <button
        onClick={() => router.push('/settings')}
        className="relative w-full px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg transition-colors text-left"
      >
        ⚙️ {t('settings')}
        {hasPendingInvites && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-yellow-400 text-zinc-900 text-[11px] font-semibold leading-none">
            {pendingInvites.length}
          </span>
        )}
      </button>
    </div>
  )
}

export default UserMenu
