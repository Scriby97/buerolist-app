'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useToast } from '@/lib/hooks/useToast'
import { ToastContainer } from '@/app/components/Toast'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { TimeInput } from '@/app/components/TimeInput'
import { updateWorkSchedule } from '@/lib/api/workSchedule'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { formatDecimalHours } from '@/lib/format/hours'
import { isValidWorkSchedule, scheduleOf, workdayMinutes, type WorkSchedule } from '@/lib/workSchedule'

/**
 * Normaler Arbeitstag des eingeloggten Mitarbeiters: daraus kommen der
 * Startzeit-Vorschlag beim Erfassen (Arbeitsbeginn, nach der Mittagspause)
 * und die Dauer fuer die Erfassungserinnerung.
 */
export default function WorkSchedulePage() {
  const router = useRouter()
  const { supabaseUser, userProfile, loading: authLoading, refreshUserRole } = useAuth()
  const { toasts, showToast, removeToast } = useToast()
  const t = useTranslations('settingsWorkSchedule')
  const tSettings = useTranslations('settings')
  const getApiErrorMessage = useApiErrorMessage()

  const [schedule, setSchedule] = useState<WorkSchedule>(() => scheduleOf(userProfile))
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!authLoading && !supabaseUser) router.push('/login')
  }, [authLoading, supabaseUser, router])

  // Werte uebernehmen, sobald das Profil geladen ist (einmal pro User)
  if (userProfile && loadedFor !== userProfile.id) {
    setLoadedFor(userProfile.id)
    setSchedule(scheduleOf(userProfile))
  }

  const valid = isValidWorkSchedule(schedule)
  const set = (key: keyof WorkSchedule) => (value: string) => setSchedule((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateWorkSchedule(schedule)
      await refreshUserRole()
      showToast(t('saveSuccess'), 'success')
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof WorkSchedule, label: string) => (
    <div className="space-y-1">
      <label htmlFor={key} className="block text-xs text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <TimeInput id={key} value={schedule[key]} onChange={set(key)} />
    </div>
  )

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: tSettings('title'), href: '/settings' },
            { label: tSettings('workScheduleTitle') },
          ]}
        />

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t('morningLabel')}</legend>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              {field('workMorningStart', t('fromLabel'))}
              {field('workMorningEnd', t('toLabel'))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{t('afternoonLabel')}</legend>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              {field('workAfternoonStart', t('fromLabel'))}
              {field('workAfternoonEnd', t('toLabel'))}
            </div>
          </fieldset>

          {valid ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {t('totalLabel')}{' '}
              <span className="font-semibold tabular-nums">{formatDecimalHours(workdayMinutes(schedule))} h</span>
            </p>
          ) : (
            <p className="text-sm text-red-700 dark:text-red-300">{t('invalidOrder')}</p>
          )}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('usageHint')}</p>

          <button
            onClick={handleSave}
            disabled={saving || !valid}
            className="px-5 py-2.5 bg-brown-600 text-white font-semibold rounded-lg hover:bg-brown-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('saving') : t('saveButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
