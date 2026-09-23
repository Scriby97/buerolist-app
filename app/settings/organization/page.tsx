'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import {
  updateOrganizationProfile,
  uploadOrganizationLogo,
  deleteOrganizationLogo,
  deleteOwnOrganization,
} from '@/lib/api/organizations'
import { resizeToSquareWebp, ImageValidationError } from '@/lib/images/resizeImage'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { useToast } from '@/lib/hooks/useToast'
import { ToastContainer } from '@/app/components/Toast'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { OrgAvatar } from '@/app/components/OrgAvatar'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'

type PendingLogo =
  | { kind: 'none' }
  | { kind: 'upload'; blob: Blob; previewUrl: string }
  | { kind: 'remove' }

export default function SettingsOrganizationPage() {
  const router = useRouter()
  const { supabaseUser, loading: authLoading, refreshOrganizations } = useAuth()
  const {
    organizations,
    selectedOrgId,
    selectedOrganizationRole,
    isLoading: orgLoading,
    refetchOrganizations,
  } = useOrganization()
  const { toasts, showToast, removeToast } = useToast()
  const t = useTranslations('settingsOrganization')
  const tSettings = useTranslations('settings')
  const getApiErrorMessage = useApiErrorMessage()

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId],
  )
  const isOwner = selectedOrganizationRole === 'owner'

  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Logo-Änderungen werden erst beim Klick auf "Speichern" tatsächlich hoch-
  // geladen/entfernt - bis dahin nur lokaler Vorschau-/Vormerk-Zustand.
  const [pendingLogo, setPendingLogo] = useState<PendingLogo>({ kind: 'none' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initializedOrgId = useRef<string | null>(null)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Nicht eingeloggt -> Login; eingeloggt aber kein Owner -> zurück zu Settings.
  useEffect(() => {
    if (authLoading || orgLoading) return
    if (!supabaseUser) {
      router.replace('/login')
      return
    }
    if (!isOwner) router.replace('/settings')
  }, [authLoading, orgLoading, supabaseUser, isOwner, router])

  // Namensfeld einmal pro Organisation vorbelegen (nicht bei jedem
  // refreshOrganizations, sonst würde die Eingabe überschrieben).
  useEffect(() => {
    if (selectedOrg && initializedOrgId.current !== selectedOrg.id) {
      initializedOrgId.current = selectedOrg.id
      setName(selectedOrg.name)
    }
  }, [selectedOrg])

  // Object-URL der Logo-Vorschau freigeben, sobald sie ersetzt/verworfen wird
  // oder die Seite verlassen wird.
  useEffect(() => {
    if (pendingLogo.kind !== 'upload') return
    const url = pendingLogo.previewUrl
    return () => URL.revokeObjectURL(url)
  }, [pendingLogo])

  const handleFilePicked = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const blob = await resizeToSquareWebp(file)
      setPendingLogo({ kind: 'upload', blob, previewUrl: URL.createObjectURL(blob) })
    } catch (err) {
      const message =
        err instanceof ImageValidationError
          ? err.message === 'unsupported-type'
            ? t('invalidImageType')
            : err.message === 'too-large'
              ? t('imageTooLarge')
              : t('imageProcessingFailed')
          : t('imageProcessingFailed')
      showToast(message, 'error')
    }
  }

  const handleLogoRemove = () => {
    setPendingLogo({ kind: 'remove' })
  }

  const handleUndoLogoChange = () => {
    setPendingLogo({ kind: 'none' })
  }

  const effectiveLogoUrl =
    pendingLogo.kind === 'upload'
      ? pendingLogo.previewUrl
      : pendingLogo.kind === 'remove'
        ? null
        : (selectedOrg?.logoUrl ?? null)
  const hasEffectiveLogo = Boolean(effectiveLogoUrl)

  const nameUnchanged = name.trim() === (selectedOrg?.name ?? '')
  const nameTooShort = name.trim().length < 2
  const nothingToSave = nameUnchanged && pendingLogo.kind === 'none'

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedOrg || nothingToSave) return
    setNameError(null)
    setSaving(true)

    try {
      if (!nameUnchanged) {
        try {
          await updateOrganizationProfile(selectedOrg.id, { name: name.trim() })
        } catch (err) {
          const message = getApiErrorMessage(err, t('nameErrorGeneric'))
          setNameError(message)
          showToast(message, 'error')
          return
        }
      }

      if (pendingLogo.kind === 'upload') {
        try {
          await uploadOrganizationLogo(selectedOrg.id, pendingLogo.blob)
        } catch (err) {
          showToast(getApiErrorMessage(err, t('logoErrorGeneric')), 'error')
          return
        }
      } else if (pendingLogo.kind === 'remove') {
        try {
          await deleteOrganizationLogo(selectedOrg.id)
        } catch (err) {
          showToast(getApiErrorMessage(err, t('logoErrorGeneric')), 'error')
          return
        }
      }

      await refetchOrganizations()
      setPendingLogo({ kind: 'none' })
      showToast(t('saveSuccess'), 'success')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOrganization = async () => {
    if (!selectedOrg || deleting) return
    setDeleting(true)
    try {
      await deleteOwnOrganization(selectedOrg.id)
      const remaining = await refreshOrganizations()
      router.replace(remaining.length === 0 ? '/onboarding' : '/')
    } catch (err) {
      showToast(getApiErrorMessage(err, t('deleteErrorGeneric')), 'error')
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (authLoading || orgLoading || !isOwner || !selectedOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-3xl mx-auto space-y-6">
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
            {t('subtitle')}
          </p>
        </div>

        <form onSubmit={handleSave} className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 space-y-6">
          {/* Logo */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t('logoSectionTitle')}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('logoSectionSubtitle')}
              </p>
            </div>

            <div className="flex items-center gap-5">
              <OrgAvatar
                name={selectedOrg.name}
                logoUrl={effectiveLogoUrl}
                size={80}
              />
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="px-4 py-2 bg-brown-600 hover:bg-brown-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hasEffectiveLogo ? t('replaceButton') : t('chooseButton')}
                  </button>
                  {hasEffectiveLogo && (
                    <button
                      type="button"
                      onClick={handleLogoRemove}
                      disabled={saving}
                      className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('removeButton')}
                    </button>
                  )}
                  {pendingLogo.kind !== 'none' && (
                    <button
                      type="button"
                      onClick={handleUndoLogoChange}
                      disabled={saving}
                      className="px-2 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors disabled:opacity-50"
                    >
                      {t('undoLogoChange')}
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {pendingLogo.kind !== 'none' ? t('logoPendingHint') : t('logoHint')}
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFilePicked}
            />
          </section>

          {/* Name */}
          <section className="border-t border-zinc-200 dark:border-zinc-700 pt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t('nameSectionTitle')}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('nameSectionSubtitle')}
              </p>
            </div>

            <div>
              <label
                htmlFor="orgName"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t('nameLabel')}
              </label>
              <input
                id="orgName"
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>

            {nameError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{nameError}</p>
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={saving || nothingToSave || nameTooShort}
            className="w-full sm:w-auto px-5 py-2.5 bg-brown-600 text-white font-semibold rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('saving') : t('saveButton')}
          </button>
        </form>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t('dangerZoneTitle')}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('dangerZoneSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            {t('deleteButton')}
          </button>
        </div>
      </div>

      {showDeleteDialog && (
        <ConfirmDialog
          title={t('deleteConfirmTitle')}
          message={t('deleteConfirmMessage', { name: selectedOrg.name })}
          confirmLabel={deleting ? t('deleting') : t('deleteConfirmLabel')}
          cancelLabel={t('deleteConfirmCancelLabel')}
          requireTypedConfirmation={selectedOrg.name}
          typedConfirmationLabel={t('deleteConfirmTypedLabel', { name: selectedOrg.name })}
          onConfirm={handleDeleteOrganization}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  )
}
