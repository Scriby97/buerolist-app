'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { ToastContainer } from '@/app/components/Toast'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { useToast } from '@/lib/hooks/useToast'
import {
  getCategoryGroups,
  createCategoryGroup,
  updateCategoryGroup,
  deleteCategoryGroup,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
  type CategoryGroup,
} from '@/lib/api/categories'
import { formatCategoryNumber } from '@/lib/categories'
import { CategoryTemplatesSection } from '@/app/components/CategoryTemplatesSection'

const inputClass =
  'px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-zinc-800 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500'
const primaryButton =
  'px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 hover:bg-brown-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const iconButton = 'p-1.5 rounded-lg transition-colors'

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)
const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

type ConfirmTarget = { kind: 'group'; group: CategoryGroup } | { kind: 'category'; category: Category }

export default function SettingsCategoriesPage() {
  const router = useRouter()
  const { loading: authLoading } = useAuth()
  const { selectedOrgId, selectedOrganizationRole, isLoading: orgLoading } = useOrganization()
  const t = useTranslations('settingsCategories')
  const tSettings = useTranslations('settings')
  const tCommon = useTranslations('common')
  const getApiErrorMessage = useApiErrorMessage()
  const { toasts, showToast, removeToast } = useToast()

  const isManager = selectedOrganizationRole === 'owner' || selectedOrganizationRole === 'admin'

  const [groups, setGroups] = useState<CategoryGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [newGroupName, setNewGroupName] = useState('')
  const [newCategoryNames, setNewCategoryNames] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; groupId?: string } | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)

  useEffect(() => {
    if (authLoading || orgLoading) return
    if (!isManager) {
      router.push('/settings')
    }
  }, [authLoading, orgLoading, isManager, router])

  const loadGroups = useCallback(async () => {
    if (!selectedOrgId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await getCategoryGroups(selectedOrgId)
      setGroups(data)
      // Bei wenigen Hauptkategorien alle offen, sonst zugeklappt.
      if (data.length <= 2) setOpenIds(new Set(data.map((g) => g.id)))
    } catch (err) {
      setError(getApiErrorMessage(err, t('loadError')))
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId])

  useEffect(() => {
    if (authLoading || orgLoading || !isManager || !selectedOrgId) return
    void loadGroups()
  }, [authLoading, orgLoading, isManager, selectedOrgId, loadGroups])

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = async (action: () => Promise<void>, successKey: string, errorKey: string) => {
    setSubmitting(true)
    try {
      await action()
      showToast(t(successKey), 'success')
    } catch (err) {
      showToast(getApiErrorMessage(err, t(errorKey)), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateGroup = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newGroupName.trim() || !selectedOrgId) return
    void run(
      async () => {
        const group = await createCategoryGroup({ name: newGroupName.trim(), organizationId: selectedOrgId })
        setGroups((prev) => [...prev, { ...group, categories: [] }])
        setOpenIds((prev) => new Set(prev).add(group.id))
        setNewGroupName('')
      },
      'groupCreateSuccess',
      'groupCreateError',
    )
  }

  const handleCreateCategory = (e: FormEvent<HTMLFormElement>, group: CategoryGroup) => {
    e.preventDefault()
    const name = (newCategoryNames[group.id] ?? '').trim()
    if (!name || !selectedOrgId) return
    void run(
      async () => {
        const category = await createCategory({ name, groupId: group.id, organizationId: selectedOrgId })
        setGroups((prev) =>
          prev.map((g) => (g.id === group.id ? { ...g, categories: [...g.categories, category] } : g)),
        )
        setNewCategoryNames((prev) => ({ ...prev, [group.id]: '' }))
      },
      'createSuccess',
      'createError',
    )
  }

  const saveGroupName = (group: CategoryGroup, name: string) =>
    run(
      async () => {
        const updated = await updateCategoryGroup(group.id, name.trim())
        setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, name: updated.name } : g)))
        setEditing(null)
      },
      'groupUpdateSuccess',
      'updateError',
    )

  const saveCategory = (category: Category, name: string, groupId: string) =>
    run(
      async () => {
        const updated = await updateCategory(category.id, {
          name: name.trim(),
          groupId: groupId !== category.groupId ? groupId : undefined,
        })
        setGroups((prev) =>
          prev.map((g) => {
            const without = g.categories.filter((c) => c.id !== category.id)
            if (g.id !== updated.groupId) return { ...g, categories: without }
            return {
              ...g,
              categories: [...without, updated].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
            }
          }),
        )
        setEditing(null)
      },
      'updateSuccess',
      'updateError',
    )

  const handleConfirmDelete = (target: ConfirmTarget) =>
    target.kind === 'group'
      ? run(
          async () => {
            await deleteCategoryGroup(target.group.id)
            setGroups((prev) => prev.filter((g) => g.id !== target.group.id))
          },
          'groupDeleteSuccess',
          'deleteError',
        )
      : run(
          async () => {
            await deleteCategory(target.category.id)
            setGroups((prev) =>
              prev.map((g) => ({ ...g, categories: g.categories.filter((c) => c.id !== target.category.id) })),
            )
          },
          'deleteSuccess',
          'deleteError',
        )

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isManager) {
    return null
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: tSettings('title'), href: '/settings' },
            { label: t('title') },
          ]}
        />

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitleGroups')}</p>
        </div>

        <form onSubmit={handleCreateGroup} className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder={t('newGroupPlaceholder')}
            aria-label={t('newGroupPlaceholder')}
            className={`flex-1 ${inputClass}`}
          />
          <button type="submit" disabled={submitting || !newGroupName.trim()} className={primaryButton}>
            {t('addGroupButton')}
          </button>
        </form>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">{t('noGroups')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const open = openIds.has(group.id)
              const editingGroup = editing?.id === group.id
              return (
                <div key={group.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  <div className="flex items-center gap-2 px-4 py-3">
                    {editingGroup ? (
                      <input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        aria-label={t('groupNameLabel')}
                        autoFocus
                        className={`flex-1 ${inputClass} py-1`}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleOpen(group.id)}
                        aria-expanded={open}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <svg className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M9 6l6 6-6 6" />
                        </svg>
                        <span className="font-mono text-sm tabular-nums text-zinc-500 dark:text-zinc-400">{group.number}</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-50">{group.name}</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">({group.categories.length})</span>
                      </button>
                    )}
                    <div className="flex gap-1 shrink-0">
                      {editingGroup ? (
                        <>
                          <button
                            onClick={() => editing.name.trim() && void saveGroupName(group, editing.name)}
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
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditing({ id: group.id, name: group.name })}
                            className={`${iconButton} hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400`}
                            title={t('renameGroup')}
                            aria-label={t('renameGroup')}
                          >
                            <EditIcon />
                          </button>
                          <button
                            onClick={() => setConfirmTarget({ kind: 'group', group })}
                            disabled={group.categories.length > 0}
                            className={`${iconButton} hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                            title={group.categories.length > 0 ? t('groupNotEmptyHint') : t('deleteGroup')}
                            aria-label={t('deleteGroup')}
                          >
                            <DeleteIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div className="border-t border-zinc-200 dark:border-zinc-700">
                      {group.categories.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">{t('noCategoriesInGroup')}</p>
                      ) : (
                        <ul className="divide-y divide-zinc-100 dark:divide-zinc-700/60">
                          {group.categories.map((category) => {
                            const isEditing = editing?.id === category.id
                            return (
                              <li key={category.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                                <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                                  {formatCategoryNumber(group.number, category.number)}
                                </span>
                                {isEditing ? (
                                  <>
                                    <input
                                      value={editing.name}
                                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                                      aria-label={t('categoryNameLabel')}
                                      autoFocus
                                      className={`flex-1 min-w-32 ${inputClass} py-1`}
                                    />
                                    <select
                                      value={editing.groupId ?? group.id}
                                      onChange={(e) => setEditing({ ...editing, groupId: e.target.value })}
                                      aria-label={t('moveToGroupLabel')}
                                      className={`${inputClass} py-1`}
                                    >
                                      {groups.map((g) => (
                                        <option key={g.id} value={g.id}>
                                          {g.number} {g.name}
                                        </option>
                                      ))}
                                    </select>
                                  </>
                                ) : (
                                  <span className="flex-1 text-sm text-zinc-900 dark:text-zinc-50">{category.name}</span>
                                )}
                                <div className="flex gap-1 shrink-0">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() =>
                                          editing.name.trim() &&
                                          void saveCategory(category, editing.name, editing.groupId ?? group.id)
                                        }
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
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => setEditing({ id: category.id, name: category.name, groupId: group.id })}
                                        className={`${iconButton} hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400`}
                                        title={tCommon('edit')}
                                        aria-label={tCommon('edit')}
                                      >
                                        <EditIcon />
                                      </button>
                                      <button
                                        onClick={() => setConfirmTarget({ kind: 'category', category })}
                                        className={`${iconButton} hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400`}
                                        title={tCommon('delete')}
                                        aria-label={tCommon('delete')}
                                      >
                                        <DeleteIcon />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      <form onSubmit={(e) => handleCreateCategory(e, group)} className="flex gap-2 border-t border-zinc-100 dark:border-zinc-700/60 px-4 py-3">
                        <input
                          value={newCategoryNames[group.id] ?? ''}
                          onChange={(e) => setNewCategoryNames((prev) => ({ ...prev, [group.id]: e.target.value }))}
                          placeholder={t('newCategoryPlaceholder')}
                          aria-label={t('newCategoryInGroupLabel', { group: group.name })}
                          className={`flex-1 ${inputClass}`}
                        />
                        <button
                          type="submit"
                          disabled={submitting || !(newCategoryNames[group.id] ?? '').trim()}
                          className={primaryButton}
                        >
                          {t('addButton')}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!isLoading && selectedOrgId && (
        <div className="max-w-2xl mx-auto mt-10">
          <CategoryTemplatesSection organizationId={selectedOrgId} groups={groups} showToast={showToast} />
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.kind === 'group' ? t('confirmDeleteGroupTitle') : t('confirmDeleteTitle')}
          message={confirmTarget.kind === 'group' ? t('confirmDeleteGroupMessage') : t('confirmDeleteMessage')}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => {
            void handleConfirmDelete(confirmTarget)
            setConfirmTarget(null)
          }}
          onCancel={() => setConfirmTarget(null)}
        />
      )}
    </div>
  )
}
