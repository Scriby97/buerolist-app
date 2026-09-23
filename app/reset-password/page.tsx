'use client'

import { useEffect, useState, type FC, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

type PageStatus = 'loading' | 'ready' | 'success' | 'error'

const ResetPasswordPage: FC = () => {
  const router = useRouter()
  const supabase = createClient()
  const t = useTranslations('resetPassword')
  const [status, setStatus] = useState<PageStatus>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    const initRecovery = async () => {
      if (typeof window === 'undefined') {
        return
      }

      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      const errorDescription = searchParams.get('error_description')
      const errorParam = searchParams.get('error')

      if (errorDescription || errorParam) {
        setMessage(decodeURIComponent(errorDescription ?? errorParam ?? t('invalidLinkError')))
        setStatus('error')
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setMessage(error.message)
          setStatus('error')
          return
        }

        window.history.replaceState({}, '', '/reset-password')
        setStatus('ready')
        return
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (accessToken && refreshToken) {
        if (type && type !== 'recovery') {
          setMessage(t('invalidRecoveryLinkError'))
          setStatus('error')
          return
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          setMessage(error.message)
          setStatus('error')
          return
        }

        window.history.replaceState({}, '', '/reset-password')
        setStatus('ready')
        return
      }

      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setStatus('ready')
        return
      }

      setMessage(t('noValidLinkError'))
      setStatus('error')
    }

    initRecovery()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)

    if (formData.password.length < 6) {
      setMessage(t('passwordTooShortError'))
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage(t('passwordMismatchError'))
      return
    }

    setSubmitting(true)

    const { error } = await supabase.auth.updateUser({
      password: formData.password,
    })

    if (error) {
      setMessage(error.message)
      setSubmitting(false)
      return
    }

    setStatus('success')
    setSubmitting(false)
  }

  const handleGoToLogin = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">{t('preparingRecovery')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{t('resetFailedTitle')}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">{message}</p>
            <button
              onClick={handleGoToLogin}
              className="px-6 py-2 bg-brown-600 text-white rounded-lg hover:bg-brown-700 transition-colors"
            >
              {t('goToLoginButton')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{t('passwordUpdatedTitle')}</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              {t('passwordUpdatedBody')}
            </p>
            <button
              onClick={handleGoToLogin}
              className="px-6 py-2 bg-brown-600 text-white rounded-lg hover:bg-brown-700 transition-colors"
            >
              {t('goToLoginButton')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('newPasswordTitle')}</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t('newPasswordSubtitle')}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-800 shadow-lg rounded-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t('newPasswordLabel')}
              </label>
              <input
                id="password"
                type="password"
                required
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-700 dark:text-zinc-100"
                minLength={6}
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                {t('confirmPasswordLabel')}
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

            {message && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-800 dark:text-red-200">{message}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-brown-600 hover:bg-brown-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('submitting') : t('submitButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
