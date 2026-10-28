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
import { formatChf, parseChfToRappen, sanitizeDecimalInput } from '@/lib/format/money'
import { formatPresetNumber } from '@/lib/format/numbers'
import {
  createItemPreset,
  deleteItemPreset,
  getItemPresets,
  updateItemPreset,
  type ItemPreset,
} from '@/lib/api/itemPresets'
import type { TimeEntryItemType } from '@/lib/api/timeEntries'

const inputClass =
  'px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'

/** Preis-Eingabe -> Rappen; leer = ohne Preis (null), unlesbar = undefined */
const priceToRappen = (text: string): number | null | undefined => {
  if (!text.trim()) return null
  return parseChfToRappen(text) ?? undefined
}

/**
 * Vordefinierte Material- und Spesen-Positionen der Organisation (nur
 * Admin/Owner). Nummern: Material M-001..., Spesen S-001... Beim Erfassen
 * waehlbar, freie Eingabe bleibt moeglich.
 */
export default function ItemPresetsPage() {
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const { selectedOrgId, canManageSelectedOrganization, isLoading: orgLoading } = useOrganization()
  const t = useTranslations('itemPresets')
  const tSettings = useTranslations('settings')
  const tCommon = useTranslations('common')
  const getApiErrorMessage = useApiErrorMessage()
  const { toasts, showToast, removeToast } = useToast()

  const [presets, setPresets] = useState<ItemPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<TimeEntryItemType, { description: string; price: string }>>({
    material: { description: '', price: '' },
    expense: { description: '', price: '' },
  })
  const [editing, setEditing] = useState<{ id: string; description: string; price: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ItemPreset | null>(null)

  useEffect(() => {
    if (authLoading || orgLoading) return
    if (!canManageSelectedOrganization) router.push('/settings')
  }, [authLoading, orgLoading, canManageSelectedOrganization, router])

  useEffect(() => {
    if (!selectedOrgId || !canManageSelectedOrganization) return
    getItemPresets(selectedOrgId)
      .then(setPresets)
      .catch((err) => showToast(getApiErrorMessage(err, t('loadError')), 'error'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, canManageSelectedOrganization])

  const replace = (saved: ItemPreset) =>
    setPresets((prev) => [...prev.filter((p) => p.id !== saved.id), saved].sort((a, b) => a.number - b.number))

  const handleAdd = async (type: TimeEntryItemType, event: FormEvent) => {
    event.preventDefault()
    if (!selectedOrgId) return
    const draft = drafts[type]
    const unitPriceRappen = priceToRappen(draft.price)
    if (!draft.description.trim() || unitPriceRappen === undefined) return
    try {
      const saved = await createItemPreset({
        organizationId: selectedOrgId,
        type,
        description: draft.description.trim(),
        unitPriceRappen,
      })
      replace(saved)
      setDrafts((prev) => ({ ...prev, [type]: { description: '', price: '' } }))
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error')
    }
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    const unitPriceRappen = priceToRappen(editing.price)
    if (!editing.description.trim() || unitPriceRappen === undefined) return
    try {
      replace(await updateItemPreset(editing.id, { description: editing.description.trim(), unitPriceRappen }))
      setEditing(null)
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await deleteItemPreset(confirmDelete.id)
      setPresets((prev) => prev.filter((p) => p.id !== confirmDelete.id))
    } catch (err) {
      showToast(getApiErrorMessage(err, t('deleteError')), 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  if (authLoading || orgLoading || !canManageSelectedOrganization) return null

  const section = (type: TimeEntryItemType) => {
    const list = presets.filter((p) => p.type === type)
    const draft = drafts[type]
    const draftPriceInvalid = priceToRappen(draft.price) === undefined
    return (
      <section key={type} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {type === 'material' ? t('materialTitle') : t('expensesTitle')}
        </h2>

        {list.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{loading ? '…' : t('empty')}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-700/60">
            {list.map((preset) =>
              editing?.id === preset.id ? (
                <li key={preset.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatPresetNumber(preset.type, preset.number)}
                  </span>
                  <input
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    aria-label={t('descriptionLabel')}
                    maxLength={200}
                    autoFocus
                    className={`min-w-0 flex-1 ${inputClass} py-1`}
                  />
                  <input
                    value={editing.price}
                    onChange={(e) => setEditing({ ...editing, price: sanitizeDecimalInput(e.target.value, 2) })}
                    aria-label={t('priceLabel')}
                    inputMode="decimal"
                    placeholder={t('pricePlaceholder')}
                    className={`w-24 ${inputClass} py-1 text-right tabular-nums`}
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-brown-600 hover:bg-brown-700 text-white"
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
                <li key={preset.id} className="flex items-center gap-2 py-2">
                  <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {formatPresetNumber(preset.type, preset.number)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-zinc-900 dark:text-zinc-50">{preset.description}</span>
                  <span className="shrink-0 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                    {preset.unitPriceRappen !== null ? `CHF ${formatChf(preset.unitPriceRappen)}` : t('noPrice')}
                  </span>
                  <button
                    onClick={() =>
                      setEditing({
                        id: preset.id,
                        description: preset.description,
                        price: preset.unitPriceRappen !== null ? formatChf(preset.unitPriceRappen) : '',
                      })
                    }
                    className="px-2 py-1 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-600"
                  >
                    {tCommon('edit')}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(preset)}
                    className="px-2 py-1 text-xs font-medium rounded-lg border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300"
                  >
                    {tCommon('delete')}
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        <form onSubmit={(e) => handleAdd(type, e)} className="flex flex-wrap gap-2 border-t border-zinc-100 dark:border-zinc-700/60 pt-4">
          <input
            value={draft.description}
            onChange={(e) => setDrafts((prev) => ({ ...prev, [type]: { ...draft, description: e.target.value } }))}
            placeholder={type === 'material' ? t('newMaterialPlaceholder') : t('newExpensePlaceholder')}
            aria-label={t('descriptionLabel')}
            maxLength={200}
            className={`min-w-0 flex-1 ${inputClass}`}
          />
          <input
            value={draft.price}
            onChange={(e) => setDrafts((prev) => ({ ...prev, [type]: { ...draft, price: sanitizeDecimalInput(e.target.value, 2) } }))}
            placeholder={t('pricePlaceholder')}
            aria-label={t('priceLabel')}
            aria-invalid={draftPriceInvalid}
            inputMode="decimal"
            className={`w-28 ${inputClass} text-right tabular-nums`}
          />
          <button
            type="submit"
            disabled={!draft.description.trim() || draftPriceInvalid}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 hover:bg-brown-700 text-white disabled:opacity-50"
          >
            {t('addButton')}
          </button>
        </form>
      </section>
    )
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: tSettings('title'), href: '/settings' },
            { label: tSettings('itemPresetsTitle') },
          ]}
        />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
        </div>
        {section('expense')}
        {section('material')}
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMessage', { name: confirmDelete.description })}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
