'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/useToast'
import { ToastContainer } from '@/app/components/Toast'
import Breadcrumbs from '@/app/components/Breadcrumbs'

export default function SettingsAccountPage() {
  const router = useRouter()
  const { supabaseUser, loading: authLoading, signOut } = useAuth()
  const { toasts, showToast, removeToast } = useToast()
  const [signingOut, setSigningOut] = useState(false)
  const t = useTranslations('settingsAccount')
  const tSettings = useTranslations('settings')
  const supabase = useMemo(() => createClient(), [])

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !supabaseUser) {
      router.push('/login')
    }
  }, [authLoading, supabaseUser, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (formData.newPassword.length < 6) {
      setError(t('passwordTooShortError'))
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('passwordMismatchError'))
      return
    }

    setSubmitting(true)

    try {
      // Bewusst client-seitig ueber die eigene Session - so bleibt sie gueltig.
      // Ein Backend-Wechsel via admin.updateUserById wuerde dem Browser den
      // Refresh-Token entziehen.
      const { error: updateError } = await supabase.auth.updateUser({
        password: formData.newPassword,
      })
      if (updateError) {
        throw updateError
      }
      showToast(t('updateSuccess'), 'success')
      setFormData({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('updateErrorGeneric')
      setError(message)
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    router.push('/login')
    router.refresh()
  }

  if (authLoading) {
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

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 space-y-6">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('loggedInLabel')}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {supabaseUser?.email}
            </p>
          </section>

          <section className="border-t border-zinc-200 dark:border-zinc-700 pt-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t('changePasswordTitle')}
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('changePasswordSubtitle')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  {t('newPasswordLabel')}
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={formData.newPassword}
                  onChange={(event) => setFormData({ ...formData, newPassword: event.target.value })}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
                  minLength={6}
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  {t('repeatPasswordLabel')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(event) => setFormData({ ...formData, confirmPassword: event.target.value })}
                  className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
                  minLength={6}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-5 py-2.5 bg-brown-600 text-white font-semibold rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('submitting') : t('submitButton')}
              </button>
            </form>
          </section>

          <section className="border-t border-zinc-200 dark:border-zinc-700 pt-6 space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('sessionTitle')}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('sessionSubtitle')}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="px-5 py-2.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-100 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signingOut ? t('signingOut') : t('signOutButton')}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
