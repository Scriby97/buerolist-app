'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { ToastContainer } from '@/app/components/Toast'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { useToast } from '@/lib/hooks/useToast'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { formatAbsenceReasonNumber } from '@/lib/format/numbers'
import {
  createAbsenceReason,
  deleteAbsenceReason,
  getAbsenceReasons,
  updateAbsenceReason,
  type AbsenceReason,
} from '@/lib/api/absences'

const inputClass =
  'px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'

/**
 * Abwesenheitsgruende der Organisation (nur Admin/Owner), z.B. Krankheit,
 * Unfall, Militär/Zivilschutz, Feuerwehr, Ferien - nummeriert A-001, A-002, ...
 * Mitarbeiter koennen beim Erfassen zusaetzlich einen eigenen Grund
 * eingeben. Ein Grund, der schon verwendet
 * wird, kann nicht geloescht werden (Backend: ABSENCE_REASON_IN_USE).
 */
export default function AbsenceReasonsPage() {
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const { selectedOrgId, canManageSelectedOrganization, isLoading: orgLoading } = useOrganization()
  const t = useTranslations('absenceReasons')
  const tSettings = useTranslations('settings')
  const tCommon = useTranslations('common')
  const getApiErrorMessage = useApiErrorMessage()
  const { toasts, showToast, removeToast } = useToast()

  const [reasons, setReasons] = useState<AbsenceReason[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AbsenceReason | null>(null)

  useEffect(() => {
    if (authLoading || orgLoading) return
    if (!canManageSelectedOrganization) router.push('/settings')
  }, [authLoading, orgLoading, canManageSelectedOrganization, router])

  useEffect(() => {
    if (!selectedOrgId || !canManageSelectedOrganization) return
    getAbsenceReasons(selectedOrgId)
      .then(setReasons)
      .catch((err) => showToast(getApiErrorMessage(err, t('loadError')), 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, canManageSelectedOrganization])

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedOrgId || !draft.trim()) return
    try {
      const saved = await createAbsenceReason({ organizationId: selectedOrgId, name: draft.trim() })
      setReasons((prev) => [...prev, saved])
      setDraft('')
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error')
    }
  }

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return
    try {
      const saved = await updateAbsenceReason(editing.id, { name: editing.name.trim() })
      setReasons((prev) => prev.map((r) => (r.id === saved.id ? saved : r)))
      setEditing(null)
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteAbsenceReason(confirmDelete.id)
      setReasons((prev) => prev.filter((r) => r.id !== confirmDelete.id))
    } catch (err) {
      showToast(getApiErrorMessage(err, t('deleteError')), 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  if (authLoading || orgLoading || !canManageSelectedOrganization) return null

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: tSettings('title'), href: '/settings' },
            { label: tSettings('absenceReasonsTitle') },
          ]}
        />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
        </div>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-4">
          {reasons.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{loading ? '…' : t('empty')}</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-700/60">
              {reasons.map((reason) =>
                editing?.id === reason.id ? (
                  <li key={reason.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatAbsenceReasonNumber(reason.number)}
                    </span>
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveEdit()
                      }}
                      aria-label={t('nameLabel')}
                      maxLength={100}
                      autoFocus
                      className={`min-w-0 flex-1 ${inputClass} py-1`}
                    />
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editing.name.trim()}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-brown-600 hover:bg-brown-700 text-white disabled:opacity-50"
                    >
                      {tCommon('save')}
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-600"
                    >
                      {tCommon('cancel')}
                    </button>
                  </li>
                ) : (
                  <li key={reason.id} className="flex items-center gap-2 py-2">
                    <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatAbsenceReasonNumber(reason.number)}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-zinc-900 dark:text-zinc-50">{reason.name}</span>
                    <button
                      onClick={() => setEditing({ id: reason.id, name: reason.name })}
                      className="px-2 py-1 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-600"
                    >
                      {tCommon('edit')}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(reason)}
                      className="px-2 py-1 text-xs font-medium rounded-lg border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                    >
                      {tCommon('delete')}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}

          <form onSubmit={handleAdd} className="flex flex-wrap gap-2 border-t border-zinc-100 dark:border-zinc-700/60 pt-4">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('newPlaceholder')}
              aria-label={t('nameLabel')}
              maxLength={100}
              className={`min-w-0 flex-1 ${inputClass}`}
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 hover:bg-brown-700 text-white disabled:opacity-50"
            >
              {t('addButton')}
            </button>
          </form>
        </section>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMessage', { name: confirmDelete.name })}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
