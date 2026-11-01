'use client';

import { useEffect, useState, type FC, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { getApiBaseUrlOrNull } from '@/lib/api/url';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { createAbsences, getAbsenceReasons, type AbsencePortion, type AbsenceReason } from '@/lib/api/absences';
import { currentWeekStartKey } from '@/lib/time/workWeek';
import { formatDecimalHours, parseDecimalHours } from '@/lib/format/hours';
import { DateInput } from './DateInput';

const pad2 = (n: number) => String(n).padStart(2, '0');
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

interface CreateAbsenceFormProps {
  organizationId: string;
  /** Personen, fuer die erfasst wird (Auswahl "Erfassen für" der Erfassungsseite) */
  selectedIds: string[];
  myId: string;
  /** Feld "Erfassen für" (nur Admin/Owner), von der Erfassungsseite geteilt */
  employeesField?: ReactNode;
  canManage: boolean;
  /** Dauer des eigenen Arbeitstags (Hinweis bei "Ganzer Tag") */
  ownWorkdayMinutes: number;
  onSaved: (count: number) => void;
}

/**
 * Abwesenheit erfassen (Krankheit, Militär, ...): Grund, Tag bzw. Zeitraum
 * (Wochenenden werden uebersprungen) und Umfang - ganzer Tag (persoenliche
 * Arbeitszeiten), halber Tag oder Stunden.
 */
export const CreateAbsenceForm: FC<CreateAbsenceFormProps> = ({
  organizationId,
  selectedIds,
  myId,
  employeesField,
  canManage,
  ownWorkdayMinutes,
  onSaved,
}) => {
  const t = useTranslations('absences');
  const getApiErrorMessage = useApiErrorMessage();

  const [reasons, setReasons] = useState<AbsenceReason[]>([]);
  const [reasonId, setReasonId] = useState('');
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const [portion, setPortion] = useState<AbsencePortion>('full');
  const [hours, setHours] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getApiBaseUrlOrNull()) return;
    let cancelled = false;
    getAbsenceReasons(organizationId)
      .then((list) => {
        if (cancelled) return;
        setReasons(list);
        setReasonId((current) => (list.some((r) => r.id === current) ? current : (list[0]?.id ?? '')));
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, t('reasonsLoadError')));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const hoursMinutes = parseDecimalHours(hours);
  const hoursInvalid = portion === 'hours' && !hoursMinutes;
  const rangeInvalid = Boolean(to) && to < from;
  const isRange = Boolean(to) && to !== from;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reasonId || hoursInvalid || rangeInvalid || selectedIds.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createAbsences({
        organizationId,
        reasonId,
        from,
        to: isRange ? to : undefined,
        portion,
        minutes: portion === 'hours' ? (hoursMinutes ?? undefined) : undefined,
        comment: comment.trim() || undefined,
        ...(selectedIds.length > 1
          ? { creatorIds: selectedIds }
          : selectedIds[0] !== myId
            ? { creatorId: selectedIds[0] }
            : {}),
      });
      setComment('');
      onSaved(created.length);
    } catch (err) {
      setError(getApiErrorMessage(err, t('saveError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';
  const portions: { value: AbsencePortion; label: string }[] = [
    { value: 'full', label: t('portionFull') },
    { value: 'half', label: t('portionHalf') },
    { value: 'hours', label: t('portionHours') },
  ];

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
        </div>
      )}

      {employeesField}

      <div className="space-y-2">
        <label htmlFor="absenceReason" className={labelClass}>
          {t('reasonLabel')}
        </label>
        <select
          id="absenceReason"
          value={reasonId}
          onChange={(e) => setReasonId(e.target.value)}
          required
          className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2.5 text-zinc-900 dark:text-zinc-50"
        >
          {reasons.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.name}
            </option>
          ))}
        </select>
        {reasons.length === 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{canManage ? t('noReasonsManager') : t('noReasons')}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label htmlFor="absenceFrom" className={labelClass}>
            {t('fromLabel')}
          </label>
          <DateInput
            id="absenceFrom"
            value={from}
            onChange={(value) => {
              setFrom(value);
              // Bis folgt Von, solange es nicht davor liegt
              setTo((current) => (!current || current < value ? value : current));
            }}
            required
            min={canManage ? undefined : currentWeekStartKey()}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="absenceTo" className={labelClass}>
            {t('toLabel')}
          </label>
          <DateInput id="absenceTo" value={to} onChange={setTo} min={from} />
        </div>
      </div>
      {rangeInvalid ? (
        <p className="-mt-3 text-xs text-red-600 dark:text-red-400">{t('rangeInvalid')}</p>
      ) : (
        isRange && <p className="-mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t('rangeHint')}</p>
      )}

      <fieldset className="space-y-2">
        <legend className={labelClass}>{t('portionLabel')}</legend>
        <div className="grid grid-cols-3 gap-2">
          {portions.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                portion === option.value
                  ? 'border-brown-600 bg-brown-50 text-brown-800 dark:border-brown-400 dark:bg-brown-900/30 dark:text-brown-100'
                  : 'border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300'
              }`}
            >
              <input
                type="radio"
                name="absencePortion"
                value={option.value}
                checked={portion === option.value}
                onChange={() => setPortion(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        {portion === 'hours' ? (
          <div className="space-y-1">
            <label htmlFor="absenceHours" className="sr-only">
              {t('hoursLabel')}
            </label>
            <input
              id="absenceHours"
              type="text"
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder={t('hoursPlaceholder')}
              aria-invalid={hours !== '' && hoursInvalid}
              className="block w-32 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 tabular-nums"
            />
            {hours !== '' && hoursInvalid && (
              <p className="text-xs text-red-600 dark:text-red-400">{t('hoursInvalid')}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {selectedIds.some((id) => id !== myId)
              ? t('portionHintOthers')
              : t('portionHint', {
                  hours: formatDecimalHours(portion === 'full' ? ownWorkdayMinutes : Math.round(ownWorkdayMinutes / 2)),
                })}
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="absenceComment" className={labelClass}>
          {t('commentLabel')}
        </label>
        <textarea
          id="absenceComment"
          rows={2}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !reasonId || hoursInvalid || rangeInvalid || selectedIds.length === 0}
        className="w-full rounded-lg bg-brown-600 hover:bg-brown-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 font-medium text-white transition-colors"
      >
        {isSubmitting ? t('submitting') : t('submitButton')}
      </button>
    </form>
  );
};
