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
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from '@/lib/api/categories'

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

  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || orgLoading) return
    if (!isManager) {
      router.push('/settings')
    }
  }, [authLoading, orgLoading, isManager, router])

  const loadCategories = useCallback(async () => {
    if (!selectedOrgId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await getCategories(selectedOrgId)
      setCategories([...data].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setError(getApiErrorMessage(err, t('loadError')))
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId])

  useEffect(() => {
    if (authLoading || orgLoading || !isManager || !selectedOrgId) return
    void loadCategories()
  }, [authLoading, orgLoading, isManager, selectedOrgId, loadCategories])

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!newName.trim() || !selectedOrgId) return
    setSubmitting(true)
    try {
      const category = await createCategory({ name: newName.trim(), organizationId: selectedOrgId })
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
      showToast(t('createSuccess'), 'success')
    } catch (err) {
      showToast(getApiErrorMessage(err, t('createError')), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return
    try {
      const updated = await updateCategory(id, editingName.trim())
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)),
      )
      setEditingId(null)
      showToast(t('updateSuccess'), 'success')
    } catch (err) {
      showToast(getApiErrorMessage(err, t('updateError')), 'error')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      showToast(t('deleteSuccess'), 'success')
    } catch (err) {
      showToast(getApiErrorMessage(err, t('deleteError')), 'error')
    }
  }

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isManager) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
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
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
        </div>

        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('newCategoryPlaceholder')}
            className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-800 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={submitting || !newName.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 hover:bg-brown-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('addButton')}
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
        ) : categories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">{t('noCategories')}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between gap-3 px-4 py-3">
                {editingId === category.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                    className="flex-1 px-2 py-1 border border-zinc-300 dark:border-zinc-600 rounded text-sm dark:bg-zinc-700 dark:text-zinc-100"
                  />
                ) : (
                  <span className="text-sm text-zinc-900 dark:text-zinc-50">{category.name}</span>
                )}
                <div className="flex gap-1 shrink-0">
                  {editingId === category.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(category.id)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-brown-600 hover:bg-brown-700 text-white transition-colors"
                      >
                        {tCommon('save')}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                      >
                        {tCommon('cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(category)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
                        title={tCommon('edit')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(category.id)}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                        title={tCommon('delete')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {confirmDeleteId && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMessage')}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null) }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  )
}
