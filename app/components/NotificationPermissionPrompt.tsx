'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getReminderSettings, updateReminderSettings } from '@/lib/api/notifications';
import {
  ensurePushSubscription,
  isPushNotificationSupported,
  PushPermissionError,
} from '@/lib/notifications/pushSubscription';

// Muss mit dem Backend-Default in NotificationsService.getReminder uebereinstimmen.
const DEFAULT_TIME = '17:30';

type Phase = 'hidden' | 'ask' | 'busy' | 'result';

/**
 * Fragt einmalig (pro Browser/Geraet) direkt im Dashboard nach der
 * Benachrichtigungs-Berechtigung, statt darauf zu warten, dass der User von
 * sich aus in die Einstellungen geht. "Einmalig" wird darueber erkannt, dass
 * fuer den User noch kein EntryReminder-Datensatz existiert (GET
 * /notifications/reminder liefert dann keine id, siehe
 * NotificationsService.getReminder) - sowohl Zustimmen als auch Ablehnen
 * legen sofort einen Datensatz an, damit nie ein zweites Mal gefragt wird.
 */
export function NotificationPermissionPrompt() {
  const { supabaseUser, userProfile, hasOrganization } = useAuth();
  const t = useTranslations('notificationPrompt');
  const tReminders = useTranslations('settingsReminders');
  const tCommon = useTranslations('common');

  const [phase, setPhase] = useState<Phase>('hidden');
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    // Erst pruefen, wenn der User eingeloggt ist, sein Profil geladen ist und
    // er einer Organisation angehoert (nicht waehrend Onboarding/Redirects).
    if (!supabaseUser || !userProfile || !hasOrganization) return;
    // Auch fragen, wenn der Browser Benachrichtigungen schon erlaubt hat - die
    // Erinnerung selbst ist standardmaessig aus und wird erst mit "Aktivieren"
    // eingeschaltet. Nur bei blockierten Benachrichtigungen bringt Fragen nichts.
    if (!isPushNotificationSupported() || Notification.permission === 'denied') {
      setChecked(true);
      return;
    }

    let cancelled = false;
    getReminderSettings()
      .then((settings) => {
        if (!cancelled && !settings.id) {
          setPhase('ask');
        }
      })
      .catch(() => {
        // Laden fehlgeschlagen - lieber gar nicht fragen als mit falschem
        // Zustand, beim naechsten Besuch wird es erneut versucht.
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [checked, supabaseUser, userProfile, hasOrganization]);

  const handleEnable = async () => {
    setPhase('busy');
    try {
      await ensurePushSubscription();
      await updateReminderSettings(true, DEFAULT_TIME);
      setPhase('hidden');
    } catch (err) {
      // Datensatz trotzdem als (deaktiviert) anlegen, damit nicht bei jedem
      // Login erneut gefragt wird - die Browser-Berechtigung selbst verhindert
      // das im Erfolgsfall zwar schon (permission ist dann nicht mehr
      // "default"), aber z.B. bei einem Netzwerkfehler waere sie es noch.
      await updateReminderSettings(false, DEFAULT_TIME).catch(() => {});
      const message =
        err instanceof PushPermissionError
          ? err.code === 'blocked'
            ? tReminders('permissionBlockedError')
            : err.code === 'denied'
              ? tReminders('permissionDeniedError')
              : tReminders('notConfiguredError')
          : t('genericError');
      setResultMessage(message);
      setPhase('result');
    }
  };

  const handleDismiss = async () => {
    setPhase('busy');
    try {
      await updateReminderSettings(false, DEFAULT_TIME);
    } catch {
      // Speichern fehlgeschlagen - kein Beinbruch, dann wird beim naechsten
      // Login halt nochmal gefragt.
    } finally {
      setPhase('hidden');
    }
  };

  if (phase === 'hidden') return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-prompt-title"
    >
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-sm w-full shadow-xl space-y-4">
        {phase === 'result' ? (
          <>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {t('title')}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{resultMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setPhase('hidden')}
                autoFocus
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                {tCommon('close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3
              id="notification-prompt-title"
              className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
            >
              {t('title')}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('body')}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('laterHint')}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDismiss}
                disabled={phase === 'busy'}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {t('dismissButton')}
              </button>
              <button
                onClick={handleEnable}
                disabled={phase === 'busy'}
                className="px-4 py-2 text-sm rounded-lg bg-brown-600 hover:bg-brown-700 text-white font-medium transition-colors disabled:opacity-50"
              >
                {phase === 'busy' ? tCommon('pleaseWait') : t('enableButton')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
