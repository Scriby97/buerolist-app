'use client';

import { Fragment, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import type { TimeEntry } from '@/lib/api/timeEntries';
import { formatChf, formatQuantity } from '@/lib/format/money';
import { buildReportData, formatHm, formatTime, projectLabel } from '@/lib/reports/reportData';

export interface EmployeeReportOptions {
  category: boolean;
  comment: boolean;
  items: boolean;
  dayTotals: boolean;
  projectSummary: boolean;
}

interface EmployeeReportProps {
  entries: TimeEntry[];
  organizationName: string;
  employeeName: string;
  periodLabel: string;
  /** Gesetzt, wenn der Rapport auf ein Projekt eingeschraenkt ist */
  projectFilterLabel?: string;
  options: EmployeeReportOptions;
}

const th = 'border-b border-zinc-400 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600';
const td = 'px-2 py-1 align-top';

/**
 * Arbeitsrapport eines Mitarbeiters als schlichte Liste (Tabelle) - fuer
 * Bildschirm und Druck bzw. "Als PDF speichern". Bewusst immer hell (wie
 * Papier), unabhaengig vom Farbschema der App.
 */
export const EmployeeReport: FC<EmployeeReportProps> = ({
  entries,
  organizationName,
  employeeName,
  periodLabel,
  projectFilterLabel,
  options,
}) => {
  const t = useTranslations('reports');
  const tItems = useTranslations('entryItems');
  const dateLocale = useDateLocale();
  const data = buildReportData(entries);
  const columnCount = 4 + (options.category ? 1 : 0) + (options.comment ? 1 : 0);

  return (
    <article className="report-sheet bg-white text-zinc-900 rounded-lg border border-zinc-200 p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b-2 border-zinc-900 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{organizationName}</p>
          <h1 className="text-xl font-bold">{t('employeeReportTitle')}</h1>
          <p className="text-sm">
            <span className="font-semibold">{employeeName}</span> · {periodLabel}
            {projectFilterLabel && <> · {projectFilterLabel}</>}
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          {t('createdOn', { date: new Date().toLocaleDateString(dateLocale) })}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-600">{t('noEntries')}</p>
      ) : (
        <>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>{t('colDate')}</th>
                <th className={th}>{t('colTime')}</th>
                <th className={`${th} text-right`}>{t('colHours')}</th>
                <th className={th}>{t('colProject')}</th>
                {options.category && <th className={th}>{t('colCategory')}</th>}
                {options.comment && <th className={th}>{t('colComment')}</th>}
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) => (
                <Fragment key={day.key}>
                  {day.entries.map((entry, index) => (
                    <Fragment key={entry.id}>
                      <tr className="break-inside-avoid border-t border-zinc-200">
                        <td className={`${td} whitespace-nowrap`}>
                          {index === 0 &&
                            day.date.toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className={`${td} whitespace-nowrap tabular-nums`}>
                          {formatTime(entry.startAt)}–{formatTime(entry.endAt)}
                        </td>
                        <td className={`${td} text-right tabular-nums`}>{formatHm(Math.round((new Date(entry.endAt).getTime() - new Date(entry.startAt).getTime()) / 60000))}</td>
                        <td className={td}>{projectLabel(entry)}</td>
                        {options.category && <td className={td}>{entry.category?.name ?? '–'}</td>}
                        {options.comment && <td className={`${td} whitespace-pre-wrap`}>{entry.comment ?? ''}</td>}
                      </tr>
                      {options.items &&
                        (entry.items ?? []).map((item) => (
                          <tr key={item.id} className="text-xs text-zinc-600">
                            <td className={td} />
                            <td className={td} colSpan={columnCount - 1}>
                              {item.type === 'material' ? tItems('materialTitle') : tItems('expensesTitle')}:{' '}
                              {formatQuantity(item.quantity)}× {item.description}
                              {item.unitPriceRappen > 0 && <> · CHF {formatChf(Math.round(item.quantity * item.unitPriceRappen))}</>}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                  {options.dayTotals && (
                    <tr className="text-xs font-semibold text-zinc-700">
                      <td className={td} />
                      <td className={`${td} text-right`}>{t('dayTotal')}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatHm(day.minutes)}</td>
                      <td className={td} colSpan={columnCount - 3} />
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <table className="mt-4 ml-auto text-sm">
            <tbody>
              <tr className="border-t-2 border-zinc-900 font-bold">
                <td className="px-2 py-1">{t('totalHours')}</td>
                <td className="px-2 py-1 text-right tabular-nums">{formatHm(data.totalMinutes)}</td>
              </tr>
              {options.items && data.materialRappen > 0 && (
                <tr>
                  <td className="px-2 py-0.5">{tItems('materialTitle')}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums">CHF {formatChf(data.materialRappen)}</td>
                </tr>
              )}
              {options.items && data.expenseRappen > 0 && (
                <tr>
                  <td className="px-2 py-0.5">{tItems('expensesTitle')}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums">CHF {formatChf(data.expenseRappen)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {options.projectSummary && (
            <section className="mt-6 break-inside-avoid">
              <h2 className="mb-1 text-sm font-semibold">{t('projectSummaryTitle')}</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={th}>{t('colProject')}</th>
                    <th className={`${th} text-right`}>{t('colHours')}</th>
                    {options.items && <th className={`${th} text-right`}>{tItems('materialTitle')}</th>}
                    {options.items && <th className={`${th} text-right`}>{tItems('expensesTitle')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((project) => (
                    <tr key={project.projectId} className="border-t border-zinc-200">
                      <td className={td}>{project.label}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatHm(project.minutes)}</td>
                      {options.items && (
                        <td className={`${td} text-right tabular-nums`}>
                          {project.materialRappen ? formatChf(project.materialRappen) : ''}
                        </td>
                      )}
                      {options.items && (
                        <td className={`${td} text-right tabular-nums`}>
                          {project.expenseRappen ? formatChf(project.expenseRappen) : ''}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <div className="mt-12 grid grid-cols-2 gap-10 text-xs text-zinc-600 break-inside-avoid">
            <div className="border-t border-zinc-400 pt-1">{t('signatureEmployee')}</div>
            <div className="border-t border-zinc-400 pt-1">{t('signatureManager')}</div>
          </div>
        </>
      )}
    </article>
  );
};
