'use client';

import { useEffect, useState, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { getAbsenceReasons, updateAbsence, type Absence, type AbsenceReason } from '@/lib/api/absences';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { formatDecimalHours, minutesToDecimalInput, parseDecimalHours } from '@/lib/format/hours';
import { personName } from '@/lib/format/personName';
import { currentWeekStartKey } from '@/lib/time/workWeek';
import { DateInput } from './DateInput';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Lokaler Kalendertag als "YYYY-MM-DD" (Gegenstueck zu Absence.date). */
export const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Absence.date ("YYYY-MM-DD") als lokales Datum (00:00). */
export const absenceDay = (absence: Pick<Absence, 'date'>) => {
  const [y, m, d] = absence.date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Neutrale Farbe fuer Abwesenheiten (Kalenderpunkt, Kartenrand). */
export const ABSENCE_COLOR = { light: 'oklch(0.62 0.02 260)', dark: 'oklch(0.6 0.02 260)' };

interface AbsenceItemProps {
  absence: Absence;
  canManage: boolean;
  canEdit: boolean;
  lockedHint: string | null;
  onEdit: (absence: Absence) => void;
  onDelete: (absence: Absence) => void;
}

/** Karte einer Abwesenheit in der Tagesansicht (neben den Zeiteintraegen). */
export const AbsenceItem: FC<AbsenceItemProps> = ({ absence, canManage, canEdit, lockedHint, onEdit, onDelete }) => {
  const t = useTranslations('absences');
  const tEntries = useTranslations('myEntries');
  const tCommon = useTranslations('common');
  const recordedByName = absence.createdBy ? personName(absence.createdBy, '?') : null;

  return (
    <div className="flex items-start justify-between rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/60 p-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2.5">
          <svg className="h-8 w-8 shrink-0 text-zinc-500 dark:text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18M10 14l4 4M14 14l-4 4" />
          </svg>
          <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
            {t('cardTitle', { reason: absence.reason.name })}
          </h3>
        </div>
        <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <span className="font-medium">{t('durationLabel')}</span> {formatDecimalHours(absence.minutes)} h
          </p>
          {absence.comment && (
            <p className="whitespace-pre-wrap break-words">
              <span className="font-medium">{tEntries('commentLabel')}</span> {absence.comment}
            </p>
          )}
          {canManage && (
            <p>
              <span className="font-medium">{tEntries('employeeLabel')}:</span> {personName(absence.creator)}
            </p>
          )}
          {recordedByName && (
            <p>
              <span className="font-medium">{tEntries('createdByLabel')}</span> {recordedByName}
            </p>
          )}
        </div>
      </div>

      {lockedHint && (
        <span className="ml-4 shrink-0 p-2 text-zinc-400 dark:text-zinc-500" title={lockedHint} aria-label={lockedHint} role="img">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </span>
      )}
      {canEdit && (
        <div className="ml-4 flex shrink-0 gap-2">
          <button
            onClick={() => onEdit(absence)}
            className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
            title={tCommon('edit')}
            aria-label={tCommon('edit')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(absence)}
            className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
            title={tCommon('delete')}
            aria-label={tCommon('delete')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

interface AbsenceEditDialogProps {
  absence: Absence;
  canManage: boolean;
  onClose: () => void;
  onSaved: (absence: Absence) => void;
}

/** Abwesenheit bearbeiten: Grund, Tag, Dauer (Dezimalstunden), Bemerkung. */
export const AbsenceEditDialog: FC<AbsenceEditDialogProps> = ({ absence, canManage, onClose, onSaved }) => {
  const t = useTranslations('absences');
  const tCommon = useTranslations('common');
  const getApiErrorMessage = useApiErrorMessage();
  const [reasons, setReasons] = useState<AbsenceReason[]>([]);
  const [reasonId, setReasonId] = useState(absence.reason.id);
  const [date, setDate] = useState(absence.date);
  const [hours, setHours] = useState(minutesToDecimalInput(absence.minutes));
  const [comment, setComment] = useState(absence.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAbsenceReasons(absence.organizationId)
      .then(setReasons)
      .catch(() => setReasons([]));
  }, [absence.organizationId]);

  const minutes = parseDecimalHours(hours);
  const invalid = !minutes || !date;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateAbsence(absence.id, { reasonId, date, minutes, comment: comment.trim() || null }));
    } catch (err) {
      setError(getApiErrorMessage(err, t('saveError')));
    } finally {
      setSaving(false);
    }
  };

  const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';
  const inputClass =
    'block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50';
  // Der aktuelle Grund bleibt waehlbar, auch wenn er inzwischen fehlt
  const reasonOptions = reasons.some((r) => r.id === absence.reason.id) ? reasons : [absence.reason, ...reasons];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="absence-edit-title">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-800">
        <h2 id="absence-edit-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {t('editTitle')}
        </h2>
        {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="space-y-2">
          <label htmlFor="absenceEditReason" className={labelClass}>
            {t('reasonLabel')}
          </label>
          <select id="absenceEditReason" value={reasonId} onChange={(e) => setReasonId(e.target.value)} className={inputClass}>
            {reasonOptions.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label htmlFor="absenceEditDate" className={labelClass}>
              {t('dateLabel')}
            </label>
            <DateInput
              id="absenceEditDate"
              value={date}
              onChange={setDate}
              required
              min={canManage ? undefined : currentWeekStartKey()}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="absenceEditHours" className={labelClass}>
              {t('hoursLabel')}
            </label>
            <input
              id="absenceEditHours"
              type="text"
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-invalid={!minutes}
              className={`${inputClass} tabular-nums`}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="absenceEditComment" className={labelClass}>
            {t('commentLabel')}
          </label>
          <textarea
            id="absenceEditComment"
            rows={2}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={saving || invalid}
            className="rounded-lg bg-brown-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brown-700 disabled:opacity-50"
          >
            {tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  );
};
