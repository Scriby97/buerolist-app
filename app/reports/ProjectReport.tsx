'use client';

import { Fragment, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import type { TimeEntry } from '@/lib/api/timeEntries';
import type { ProjectDetail } from '@/lib/api/projects';
import { formatChf, formatQuantity } from '@/lib/format/money';
import { projectDisplayName } from '@/lib/format/numbers';
import { buildCategoryMatrix, formatHoursMinutes, type SummaryRowInput } from '@/lib/timeReport/buildTimeMatrix';
import { buildReportData, entryMinutes, formatHm, formatTime } from '@/lib/reports/reportData';
import { itemsTotalRappen } from '@/lib/timeEntryItems';

export interface ProjectReportOptions {
  summary: boolean;
  chart: boolean;
  costs: boolean;
  entries: boolean;
  comments: boolean;
  notes: boolean;
  photos: boolean;
}

interface ProjectReportProps {
  detail: ProjectDetail;
  entries: TimeEntry[];
  organizationName: string;
  /** z.B. "Ganzes Projekt" oder "01.10.2026 – 31.10.2026" */
  periodLabel: string;
  options: ProjectReportOptions;
}

const th = 'border-b border-zinc-400 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600';
const td = 'px-2 py-1 align-top';
const sectionTitle = 'mb-2 mt-6 text-sm font-bold uppercase tracking-wide text-zinc-700';

const creatorName = (entry: TimeEntry) =>
  `${entry.creator.firstName ?? ''} ${entry.creator.lastName ?? ''}`.trim() || entry.creator.email;

/** Summen pro Mitarbeiter+Kategorie aus den (ggf. zeitlich gefilterten) Eintraegen. */
export function entriesToSummaryRows(entries: TimeEntry[]): SummaryRowInput[] {
  const rows = new Map<string, SummaryRowInput>();
  for (const entry of entries) {
    const key = `${entry.creatorId}|${entry.categoryId ?? ''}`;
    const row = rows.get(key) ?? {
      creatorId: entry.creatorId,
      creatorFirstName: entry.creator.firstName ?? null,
      creatorLastName: entry.creator.lastName ?? null,
      creatorEmail: entry.creator.email,
      categoryId: entry.categoryId,
      categoryName: entry.category?.name ?? null,
      totalMinutes: 0,
    };
    row.totalMinutes += entryMinutes(entry);
    rows.set(key, row);
  }
  return [...rows.values()];
}

/**
 * Projekt-Rapport zum Drucken bzw. "Als PDF speichern" - bewusst immer hell
 * (wie Papier) und ohne Hell/Dunkel-Varianten, damit er auch im dunklen
 * App-Modus lesbar druckt.
 */
export const ProjectReport: FC<ProjectReportProps> = ({ detail, entries, organizationName, periodLabel, options }) => {
  const t = useTranslations('reports');
  const tItems = useTranslations('entryItems');
  const dateLocale = useDateLocale();
  const { project, notes } = detail;
  const matrix = buildCategoryMatrix(entriesToSummaryRows(entries), '?');
  const data = buildReportData(entries);
  const showTotalColumn = matrix.employees.length > 1;
  const maxCategory = Math.max(0, ...matrix.rows.map((r) => r.totalMinutes));

  // Material/Spesen pro Mitarbeiter
  const costs = matrix.employees.map((employee) => {
    const own = entries.filter((e) => e.creatorId === employee.id).flatMap((e) => e.items ?? []);
    return {
      employee,
      material: itemsTotalRappen(own.filter((i) => i.type === 'material')),
      expense: itemsTotalRappen(own.filter((i) => i.type === 'expense')),
    };
  });
  const photos = notes.flatMap((note) => note.photos.map((photo) => ({ photo, note })));

  return (
    <article className="report-sheet bg-white text-zinc-900 rounded-lg border border-zinc-200 p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b-2 border-zinc-900 pb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{organizationName}</p>
          <h1 className="text-xl font-bold">{t('projectReportTitle')}</h1>
          <p className="text-sm">
            <span className="font-semibold">{projectDisplayName(project, project.customer)}</span> · {periodLabel}
          </p>
        </div>
        <p className="text-xs text-zinc-500">{t('createdOn', { date: new Date().toLocaleDateString(dateLocale) })}</p>
      </header>

      <p className="text-sm">
        {t('totalHours')}: <span className="font-bold tabular-nums">{formatHm(data.totalMinutes)}</span>
        {data.materialRappen > 0 && <> · {tItems('materialTitle')} CHF {formatChf(data.materialRappen)}</>}
        {data.expenseRappen > 0 && <> · {tItems('expensesTitle')} CHF {formatChf(data.expenseRappen)}</>}
      </p>

      {options.summary && matrix.rows.length > 0 && (
        <section className="break-inside-avoid">
          <h2 className={sectionTitle}>{t('sectionSummary')}</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>{t('colCategory')}</th>
                {matrix.employees.map((e) => (
                  <th key={e.id} className={`${th} text-right`}>{e.name}</th>
                ))}
                {showTotalColumn && <th className={`${th} text-right`}>{t('colTotal')}</th>}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.categoryId ?? 'none'} className="border-t border-zinc-200">
                  <td className={td}>{row.categoryName ?? t('noCategory')}</td>
                  {matrix.employees.map((e) => (
                    <td key={e.id} className={`${td} text-right tabular-nums`}>{formatHoursMinutes(row.minutesByEmployee[e.id] ?? 0)}</td>
                  ))}
                  {showTotalColumn && <td className={`${td} text-right font-semibold tabular-nums`}>{formatHoursMinutes(row.totalMinutes)}</td>}
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-900 font-bold">
                <td className={td}>{t('colTotal')}</td>
                {matrix.employees.map((e) => (
                  <td key={e.id} className={`${td} text-right tabular-nums`}>{formatHoursMinutes(matrix.minutesByEmployee[e.id] ?? 0)}</td>
                ))}
                {showTotalColumn && <td className={`${td} text-right tabular-nums`}>{formatHoursMinutes(matrix.totalMinutes)}</td>}
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {options.chart && matrix.rows.length >= 2 && (
        <section className="break-inside-avoid">
          <h2 className={sectionTitle}>{t('sectionChart')}</h2>
          <ul className="space-y-1.5">
            {matrix.rows.map((row) => {
              const isTop = row.totalMinutes === maxCategory;
              const percent = matrix.totalMinutes ? Math.round((row.totalMinutes / matrix.totalMinutes) * 100) : 0;
              return (
                <li key={row.categoryId ?? 'none'} className="grid grid-cols-[10rem_1fr_6rem] items-center gap-2 text-sm">
                  <span className={`truncate ${isTop ? 'font-semibold' : ''}`}>{row.categoryName ?? t('noCategory')}</span>
                  <span className="h-3">
                    {/* Fixe Druckfarben (Akzent vs. Grau) - im dataviz-Validator geprueft */}
                    <span
                      className="block h-full rounded-r-[4px]"
                      style={{
                        width: `${Math.max((row.totalMinutes / maxCategory) * 100, 1)}%`,
                        backgroundColor: isTop ? '#2b6199' : '#a39b8a',
                        printColorAdjust: 'exact',
                        WebkitPrintColorAdjust: 'exact',
                      }}
                    />
                  </span>
                  <span className="text-right tabular-nums">
                    {formatHoursMinutes(row.totalMinutes)} <span className="text-xs text-zinc-500">{percent} %</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {options.costs && costs.some((c) => c.material || c.expense) && (
        <section className="break-inside-avoid">
          <h2 className={sectionTitle}>{t('sectionCosts')}</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>CHF</th>
                {costs.map((c) => (
                  <th key={c.employee.id} className={`${th} text-right`}>{c.employee.name}</th>
                ))}
                {showTotalColumn && <th className={`${th} text-right`}>{t('colTotal')}</th>}
              </tr>
            </thead>
            <tbody>
              {(['material', 'expense'] as const).map((type) => (
                <tr key={type} className="border-t border-zinc-200">
                  <td className={td}>{type === 'material' ? tItems('materialTitle') : tItems('expensesTitle')}</td>
                  {costs.map((c) => (
                    <td key={c.employee.id} className={`${td} text-right tabular-nums`}>
                      {c[type] ? formatChf(c[type]) : ''}
                    </td>
                  ))}
                  {showTotalColumn && (
                    <td className={`${td} text-right font-semibold tabular-nums`}>
                      {formatChf(type === 'material' ? data.materialRappen : data.expenseRappen)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {options.entries && entries.length > 0 && (
        <section>
          <h2 className={sectionTitle}>{t('sectionEntries')}</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={th}>{t('colDate')}</th>
                <th className={th}>{t('colTime')}</th>
                <th className={`${th} text-right`}>{t('colHours')}</th>
                <th className={th}>{t('employeeLabel')}</th>
                <th className={th}>{t('colCategory')}</th>
                {options.comments && <th className={th}>{t('colComment')}</th>}
              </tr>
            </thead>
            <tbody>
              {data.days.map((day) =>
                day.entries.map((entry, index) => (
                  <Fragment key={entry.id}>
                    <tr className="break-inside-avoid border-t border-zinc-200">
                      <td className={`${td} whitespace-nowrap`}>
                        {index === 0 &&
                          day.date.toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{formatTime(entry.startAt)}–{formatTime(entry.endAt)}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatHm(entryMinutes(entry))}</td>
                      <td className={td}>{creatorName(entry)}</td>
                      <td className={td}>{entry.category?.name ?? '–'}</td>
                      {options.comments && <td className={`${td} whitespace-pre-wrap`}>{entry.comment ?? ''}</td>}
                    </tr>
                    {options.costs &&
                      (entry.items ?? []).map((item) => (
                        <tr key={item.id} className="text-xs text-zinc-600">
                          <td className={td} />
                          <td className={td} colSpan={options.comments ? 5 : 4}>
                            {item.type === 'material' ? tItems('materialTitle') : tItems('expensesTitle')}: {formatQuantity(item.quantity)}×{' '}
                            {item.description} · CHF {formatChf(Math.round(item.quantity * item.unitPriceRappen))}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                )),
              )}
            </tbody>
          </table>
        </section>
      )}

      {options.comments && !options.entries && entries.some((e) => e.comment) && (
        <section>
          <h2 className={sectionTitle}>{t('sectionComments')}</h2>
          <ul className="space-y-2 text-sm">
            {[...entries]
              .filter((e) => e.comment)
              .sort((a, b) => a.startAt.localeCompare(b.startAt))
              .map((entry) => (
                <li key={entry.id} className="break-inside-avoid">
                  <p className="text-xs text-zinc-500">
                    {new Date(entry.startAt).toLocaleDateString(dateLocale)} · {creatorName(entry)}
                  </p>
                  <p className="whitespace-pre-wrap">{entry.comment}</p>
                </li>
              ))}
          </ul>
        </section>
      )}

      {options.notes && notes.length > 0 && (
        <section>
          <h2 className={sectionTitle}>{t('sectionNotes')}</h2>
          <ul className="space-y-2 text-sm">
            {notes.map((note) => (
              <li key={note.id} className="break-inside-avoid">
                <p className="text-xs text-zinc-500">{new Date(note.createdAt).toLocaleDateString(dateLocale)}</p>
                <p className="whitespace-pre-wrap">{note.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {options.photos && photos.length > 0 && (
        <section>
          <h2 className={sectionTitle}>{t('sectionPhotos')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map(({ photo, note }) => (
              <figure key={photo.id} className="break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="w-full rounded border border-zinc-200 object-cover" />
                <figcaption className="mt-0.5 text-xs text-zinc-500">
                  {new Date(note.createdAt).toLocaleDateString(dateLocale)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};
