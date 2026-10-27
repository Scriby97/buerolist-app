'use client'

import { useEffect, useState } from 'react'
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

const minutesToHhMm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** "08:30" -> 510; leer/ungueltig -> 0 */
const hhMmToMinutes = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0
}

export default function SettingsRemindersPage() {
  const router = useRouter()
  const { supabaseUser, loading: authLoading } = useAuth()
  const { toasts, showToast, removeToast } = useToast()
  const t = useTranslations('settingsReminders')
  const tSettings = useTranslations('settings')
  const getApiErrorMessage = useApiErrorMessage()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'outdated' | 'noPermission'>('idle')
  // Default fuer einen User, der die Einstellungen noch nie gespeichert hat
  // (siehe NotificationsService.getReminder im Backend: aus, 17:30) - wird
  // gleich darauf vom Server ueberschrieben.
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('17:30')
  // Arbeitstag als "HH:MM" (Dauer) - Erinnerung nur, wenn heute weniger erfasst ist
  const [workday, setWorkday] = useState('08:00')
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
        if (settings.workdayMinutes) setWorkday(minutesToHhMm(settings.workdayMinutes))
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

  // Zeigt eine Erinnerung ueber den Service Worker an (gleicher Code wie bei
  // echten Pushes). Vorher nach einer neuen SW-Version suchen; antwortet der
  // Service Worker nicht, laeuft noch eine alte Version.
  const handleTest = async () => {
    if (Notification.permission !== 'granted') {
      setTestStatus('noPermission')
      return
    }
    setTestStatus('sending')
    try {
      const registration = await navigator.serviceWorker.ready
      await registration.update().catch(() => {})
      const worker = registration.active
      const result = await new Promise<'sent' | 'failed' | 'outdated'>((resolve) => {
        if (!worker) return resolve('outdated')
        const channel = new MessageChannel()
        const timer = setTimeout(() => resolve('outdated'), 3000)
        channel.port1.onmessage = (event: MessageEvent<{ ok?: boolean }>) => {
          clearTimeout(timer)
          resolve(event.data?.ok ? 'sent' : 'failed')
        }
        worker.postMessage(
          { type: 'TEST_NOTIFICATION', payload: { title: t('testTitle'), body: t('testBody'), url: '/settings/reminders' } },
          [channel.port2],
        )
      })
      setTestStatus(result)
    } catch {
      setTestStatus('outdated')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (enabled) {
        await ensurePushSubscription()
      }
      await updateReminderSettings(enabled, time, hhMmToMinutes(workday))
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

              <div>
                <label htmlFor="workdayDuration" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {t('workdayLabel')}
                </label>
                <div className="w-full sm:w-48">
                  <TimeInput id="workdayDuration" value={workday} onChange={setWorkday} disabled={!enabled} />
                </div>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{t('workdayHint')}</p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || (enabled && (!time || !hhMmToMinutes(workday)))}
                className="px-5 py-2.5 bg-brown-600 text-white font-semibold rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? t('saving') : t('saveButton')}
              </button>

              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testStatus === 'sending'}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  {t('testButton')}
                </button>
                {testStatus !== 'idle' && testStatus !== 'sending' && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{t(`testStatus_${testStatus}`)}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
