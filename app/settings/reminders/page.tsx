'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useToast } from '@/lib/hooks/useToast'
import { ToastContainer } from '@/app/components/Toast'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { getReminderSettings, updateReminderSettings } from '@/lib/api/notifications'
import { ensurePushSubscription, PushPermissionError } from '@/lib/notifications/pushSubscription'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { TimeInput } from '@/app/components/TimeInput'

export default function SettingsRemindersPage() {
  const router = useRouter()
  const { supabaseUser, loading: authLoading } = useAuth()
  const { toasts, showToast, removeToast } = useToast()
  const t = useTranslations('settingsReminders')
  const tSettings = useTranslations('settings')
  const getApiErrorMessage = useApiErrorMessage()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // Default fuer einen User, der die Einstellungen noch nie gespeichert hat
  // (siehe NotificationsService.getReminder im Backend: aus, 17:30) - wird
  // gleich darauf vom Server ueberschrieben.
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('17:30')
  const [supported, setSupported] = useState(true)

  useEffect(() => {
    if (!authLoading && !supabaseUser) {
      router.push('/login')
    }
  }, [authLoading, supabaseUser, router])

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window
    )
  }, [])

  useEffect(() => {
    if (authLoading || !supabaseUser) return

    const load = async () => {
      try {
        const settings = await getReminderSettings()
        setEnabled(settings.enabled)
        setTime(settings.reminderTime)
      } catch (err) {
        const message = getApiErrorMessage(err, t('loadError'))
        showToast(message, 'error')
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, supabaseUser])

  const pushPermissionErrorMessage = (code: PushPermissionError['code']): string => {
    if (code === 'blocked') return t('permissionBlockedError')
    if (code === 'denied') return t('permissionDeniedError')
    return t('notConfiguredError')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (enabled) {
        await ensurePushSubscription()
      }
      await updateReminderSettings(enabled, time)
      showToast(t('saveSuccess'), 'success')
    } catch (err) {
      const message =
        err instanceof PushPermissionError
          ? pushPermissionErrorMessage(err.code)
          : getApiErrorMessage(err, t('saveErrorGeneric'))
      showToast(message, 'error')
      if (enabled) {
        // Aktivieren ist fehlgeschlagen (z.B. Berechtigung verweigert) - Toggle
        // zuruecksetzen, damit UI und tatsaechlicher Zustand nicht auseinanderlaufen.
        setEnabled(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
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
            { label: tSettings('remindersTitle') },
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
          {!supported ? (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('unsupportedMessage')}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {t('enableLabel')}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {t('enableHint')}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={t('enableLabel')}
                  onClick={() => setEnabled((prev) => !prev)}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                    enabled ? 'bg-brown-600' : 'bg-zinc-300 dark:bg-zinc-600'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label htmlFor="reminderTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('timeLabel')}
                </label>
                <div className="w-full sm:w-48">
                  <TimeInput id="reminderTime" value={time} onChange={setTime} disabled={!enabled} />
                </div>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('workdayFromScheduleHint')}{' '}
                <Link href="/settings/work-schedule" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {tSettings('workScheduleTitle')}
                </Link>
              </p>

              <button
                onClick={handleSave}
                disabled={saving || (enabled && !time)}
                className="px-5 py-2.5 bg-brown-600 text-white font-semibold rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t('saving') : t('saveButton')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
