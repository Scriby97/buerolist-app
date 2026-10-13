'use client';

import { Fragment, useEffect, useMemo, useState, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { getTimeEntries, type TimeEntry } from '@/lib/api/timeEntries';
import { buildTimeMatrix, formatHoursMinutes } from '@/lib/timeReport/buildTimeMatrix';

interface ProjectTimeReportProps {
  projectId: string;
  organizationId: string;
  projectTitle: string;
  customerName?: string;
  onClose: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * Zeitaufstellung eines Projekts: Matrix Tage (Zeilen) x Mitarbeiter (Spalten),
 * gruppiert nach Kalenderwoche mit Wochentotal. Ein Tipp auf einen Tag klappt
 * dessen einzelne Eintraege auf (wer, von-bis, Kategorie, Bemerkung).
 */
export const ProjectTimeReport: FC<ProjectTimeReportProps> = ({
  projectId,
  organizationId,
  projectTitle,
  customerName,
  onClose,
}) => {
  const t = useTranslations('projectTimeReport');
  const tCommon = useTranslations('common');
  const dateLocale = useDateLocale();
  const getApiErrorMessage = useApiErrorMessage();

  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDayKey, setOpenDayKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getTimeEntries(organizationId, { projectId, signal: controller.signal })
      .then(({ timeEntries }) => setEntries(timeEntries))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(err, t('loadError')));
      });
    return () => controller.abort();
    // getApiErrorMessage/t sind pro Render neu - nur bei Projektwechsel neu laden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, organizationId]);

  // Escape schliesst, Hintergrund scrollt nicht mit.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const matrix = useMemo(
    () => (entries ? buildTimeMatrix(entries, t('unknownEmployee')) : null),
    [entries, t],
  );

  const employeeCount = matrix?.employees.length ?? 0;
  // Spalten: Tag + je Mitarbeiter + Total (Total nur bei mehreren Mitarbeitern).
  const showTotalColumn = employeeCount > 1;
  const columnCount = 1 + employeeCount + (showTotalColumn ? 1 : 0);

  const stickyCell = 'sticky left-0 z-10';
  const numCell = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="time-report-title">
      <div className="flex w-full max-w-4xl flex-col bg-white dark:bg-zinc-900 sm:max-h-[90dvh] sm:rounded-xl shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id="time-report-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t('title')}
            </h2>
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {customerName ? `${customerName} – ${projectTitle}` : projectTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label={tCommon('close')}
            title={tCommon('close')}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {error ? (
            <p className="p-5 text-sm text-red-700 dark:text-red-300">{error}</p>
          ) : !matrix ? (
            <p className="p-5 text-sm text-zinc-500 dark:text-zinc-400">{tCommon('loading')}</p>
          ) : matrix.weeks.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500 dark:text-zinc-400">{t('noEntries')}</p>
          ) : (
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-20">
                <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  <th scope="col" className={`${stickyCell} bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-left font-medium`}>
                    {t('dayColumn')}
                  </th>
                  {matrix.employees.map((employee) => (
                    <th key={employee.id} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
                      {employee.name}
                    </th>
                  ))}
                  {showTotalColumn && (
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{t('totalColumn')}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {matrix.weeks.map((week) => (
                  <Fragment key={week.key}>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/60 font-semibold text-zinc-800 dark:text-zinc-100">
                      <th scope="row" className={`${stickyCell} bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-left whitespace-nowrap`}>
                        {t('weekLabel', { week: week.isoWeek, year: week.isoYear })}
                      </th>
                      {matrix.employees.map((employee) => (
                        <td key={employee.id} className={numCell}>
                          {formatHoursMinutes(week.minutesByEmployee[employee.id] ?? 0)}
                        </td>
                      ))}
                      {showTotalColumn && <td className={numCell}>{formatHoursMinutes(week.totalMinutes)}</td>}
                    </tr>
                    {week.days.map((day) => {
                      const isOpen = openDayKey === day.key;
                      return (
                        <Fragment key={day.key}>
                          <tr className="border-t border-zinc-100 text-zinc-700 dark:text-zinc-300">
                            <th scope="row" className={`${stickyCell} bg-white dark:bg-zinc-900 p-0 text-left font-normal`}>
                              <button
                                type="button"
                                onClick={() => setOpenDayKey(isOpen ? null : day.key)}
                                aria-expanded={isOpen}
                                className="flex w-full items-center gap-1.5 px-3 py-2 text-left whitespace-nowrap hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                <svg className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M9 6l6 6-6 6" />
                                </svg>
                                {day.date.toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                              </button>
                            </th>
                            {matrix.employees.map((employee) => (
                              <td key={employee.id} className={numCell}>
                                {formatHoursMinutes(day.minutesByEmployee[employee.id] ?? 0)}
                              </td>
                            ))}
                            {showTotalColumn && (
                              <td className={`${numCell} font-medium`}>{formatHoursMinutes(day.totalMinutes)}</td>
                            )}
                          </tr>
                          {isOpen && (
                            <tr>
                              <td colSpan={columnCount} className="bg-zinc-50 dark:bg-zinc-800/40 px-3 py-2">
                                <ul className="space-y-1.5">
                                  {day.entries.map((entry) => {
                                    const employee = matrix.employees.find((e) => e.id === entry.creatorId);
                                    return (
                                      <li key={entry.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                                        <span className="tabular-nums font-medium">
                                          {toTime(entry.startAt)}–{toTime(entry.endAt)}
                                        </span>
                                        {employeeCount > 1 && employee && <> · {employee.name}</>}
                                        {' · '}
                                        {entry.category?.name ?? t('noCategory')}
                                        {entry.comment && (
                                          <span className="block pl-0 text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap break-words">
                                            {entry.comment}
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-20">
                <tr className="bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-50">
                  <th scope="row" className={`${stickyCell} bg-zinc-100 dark:bg-zinc-800 px-3 py-2 text-left`}>
                    {t('totalRow')}
                  </th>
                  {matrix.employees.map((employee) => (
                    <td key={employee.id} className={numCell}>
                      {formatHoursMinutes(matrix.minutesByEmployee[employee.id] ?? 0)}
                    </td>
                  ))}
                  {showTotalColumn && <td className={numCell}>{formatHoursMinutes(matrix.totalMinutes)}</td>}
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        <p className="border-t border-zinc-200 dark:border-zinc-700 px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400 sm:px-5">
          {t('hint')}
        </p>
      </div>
    </div>
  );
};
