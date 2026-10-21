'use client';

import { useEffect, useId, useState, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import { getTimeEntries, type TimeEntry } from '@/lib/api/timeEntries';

interface ProjectEntryCommentsProps {
  projectId: string;
  organizationId: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/**
 * Bemerkungen aller Zeiteintraege eines Projekts (neueste zuerst), als
 * aufklappbarer Abschnitt im Projektdetail. Erscheint nur, wenn es
 * mindestens eine Bemerkung gibt.
 */
export const ProjectEntryComments: FC<ProjectEntryCommentsProps> = ({ projectId, organizationId }) => {
  const t = useTranslations('projectEntryComments');
  const dateLocale = useDateLocale();
  const panelId = useId();
  const [entries, setEntries] = useState<TimeEntry[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getTimeEntries(organizationId, { projectId, signal: controller.signal })
      .then(({ timeEntries }) =>
        setEntries(
          timeEntries
            .filter((entry) => entry.comment?.trim())
            .sort((a, b) => b.startAt.localeCompare(a.startAt)),
        ),
      )
      .catch(() => {
        // Optionaler Zusatz - bei einem Fehler einfach nicht anzeigen.
        if (!controller.signal.aborted) setEntries([]);
      });
    return () => controller.abort();
  }, [projectId, organizationId]);

  if (!entries || entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t('title')} <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">({entries.length})</span>
        </h2>
        <svg
          className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul id={panelId} className="mt-4 space-y-3">
          {entries.map((entry) => {
            const name =
              `${entry.creator.firstName ?? ''} ${entry.creator.lastName ?? ''}`.trim() || entry.creator.email;
            return (
              <li key={entry.id} className="border-t border-zinc-100 dark:border-zinc-700/60 pt-3 first:border-t-0 first:pt-0">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(entry.startAt).toLocaleDateString(dateLocale, {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                  {' · '}
                  <span className="tabular-nums">
                    {toTime(entry.startAt)}–{toTime(entry.endAt)}
                  </span>
                  {' · '}
                  {name}
                  {entry.category && <> · {entry.category.name}</>}
                </p>
                <p className="mt-0.5 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                  {entry.comment}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
