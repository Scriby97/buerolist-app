'use client';

import { useState, useEffect, useMemo, useRef, useCallback, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import { getApiBaseUrlOrNull } from '@/lib/api/url';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { getTimeEntries, updateTimeEntry, deleteTimeEntry, type TimeEntry } from '@/lib/api/timeEntries';
import { getProjectDetail } from '@/lib/api/projects';
import { getOrganizationMembers } from '@/lib/api/organizationMembers';
import type { OrganizationMemberDetail } from '@/lib/types/user';
import type { Category } from '@/lib/api/categories';
import { useToast } from '@/lib/hooks/useToast';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { ToastContainer } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import { currentWeekStartKey, isInCurrentWeek } from '@/lib/time/workWeek';
import { formatProjectNumber } from '@/lib/format/numbers';
import { colorVars, ENTITY_BORDER_LEFT, projectColor } from '@/lib/colors/entityColors';
import { EntryItemsEditor } from './EntryItemsEditor';
import { CategoryOptions } from './CategoryOptions';
import { entriesCostTotals, itemsToRows, itemsTotalRappen, rowsToItems, withTrailingEmptyRow, type ItemRow } from '@/lib/timeEntryItems';
import { formatChf, formatQuantity } from '@/lib/format/money';
import { TimeInput } from './TimeInput';
import CalendarView from './CalendarView';
import { formatDecimalHours, minutesToDecimalInput, parseDecimalHours } from '@/lib/format/hours';
import { personName } from '@/lib/format/personName';
import { getItemPresets, type ItemPreset } from '@/lib/api/itemPresets';

// Listenansicht: so viele Eintraege pro Seite, weitere laden beim Scrollen nach.
const PAGE_SIZE = 10;

function durationMinutes(startAt: string, endAt: string): number {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function formatDuration(startAt: string, endAt: string): string {
  return formatMinutes(durationMinutes(startAt, endAt));
}

interface DayGroup {
  key: string;
  date: Date;
  entries: TimeEntry[];
  totalMinutes: number;
}

// Eintraege (bereits neueste zuerst sortiert) nach lokalem Kalendertag
// gruppieren. Die Tage bleiben neueste zuerst, innerhalb eines Tages wird
// zeitlich aufsteigend sortiert (07:00-09:00 vor 09:00-17:00), so wie man
// den Arbeitstag liest.
export function groupByDay(entries: TimeEntry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byKey = new Map<string, DayGroup>();
  for (const entry of entries) {
    const start = new Date(entry.startAt);
    const key = start.toDateString();
    let group = byKey.get(key);
    if (!group) {
      group = { key, date: start, entries: [], totalMinutes: 0 };
      byKey.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
    group.totalMinutes += durationMinutes(entry.startAt, entry.endAt);
  }
  for (const group of groups) {
    group.entries.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }
  return groups;
}

function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "Material CHF 10.40 · Spesen CHF 5.00" fuer einen Tag (nur wenn vorhanden). */
const DayCostLine: FC<{ entries: TimeEntry[] }> = ({ entries }) => {
  const tItems = useTranslations('entryItems');
  const t = useTranslations('myEntries');
  const totals = entriesCostTotals(entries);
  const travel = entries.reduce((sum, entry) => sum + (entry.travelMinutes ?? 0), 0);
  if (totals.material === 0 && totals.expense === 0 && travel === 0) return null;
  return (
    <p className="-mt-1 text-right text-xs text-zinc-600 dark:text-zinc-400 tabular-nums">
      {[
        travel > 0 && `${t('travelLabel')} ${formatDecimalHours(travel)} h`,
        totals.material > 0 && `${tItems('materialTitle')} CHF ${formatChf(totals.material)}`,
        totals.expense > 0 && `${tItems('expensesTitle')} CHF ${formatChf(totals.expense)}`,
      ]
        .filter(Boolean)
        .join(' · ')}
    </p>
  );
};

interface EntryItemProps {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Fuer Mitarbeiter gesperrt (fruehere Woche oder vom Admin erfasst) - Grund als Hinweis. */
  lockedHint: string | null;
}

const EntryItem: FC<EntryItemProps> = ({ entry, onEdit, onDelete, canManage, canEdit, canDelete, lockedHint }) => {
  const t = useTranslations('myEntries');
  const tItems = useTranslations('entryItems');
  const tCommon = useTranslations('common');
  const creatorName = personName(entry.creator);
  const recordedByName = entry.createdBy ? personName(entry.createdBy, '?') : null;

  return (
    <div
      style={colorVars(projectColor(entry.project.customerNumber, entry.project.number))}
      className={`rounded-lg border border-zinc-200 dark:border-zinc-700 border-l-4 ${ENTITY_BORDER_LEFT} p-4 hover:shadow-md transition-shadow flex justify-between items-start`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-2">
          <svg className="w-8 h-8 shrink-0 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3" />
            <path d="M21 20c0-2.8-1.9-5.1-4.5-5.8" />
          </svg>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">
            {formatProjectNumber(entry.project.customerNumber, entry.project.number) && (
              <span className="mr-1.5 font-mono text-sm font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatProjectNumber(entry.project.customerNumber, entry.project.number)}
              </span>
            )}
            {entry.project.customerName} - {entry.project.title}
          </h3>
        </div>
        <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <span className="font-medium">{t('timeRangeLabel')}</span>{' '}
            {toTimeInputValue(entry.startAt)} — {toTimeInputValue(entry.endAt)}{' '}
            <span className="font-medium">({formatDuration(entry.startAt, entry.endAt)})</span>
          </p>
          {entry.category && (
            <p>
              <span className="font-medium">{t('categoryLabel')}</span> {entry.category.name}
            </p>
          )}
          {entry.travelMinutes ? (
            <p>
              <span className="font-medium">{t('travelLabel')}</span> {formatDecimalHours(entry.travelMinutes)} h
            </p>
          ) : null}
          {entry.comment && (
            <p className="whitespace-pre-wrap break-words">
              <span className="font-medium">{t('commentLabel')}</span> {entry.comment}
            </p>
          )}
          {(['material', 'expense'] as const).map((type) => {
            const items = (entry.items ?? []).filter((item) => item.type === type);
            if (items.length === 0) return null;
            return (
              <div key={type} className="pt-1">
                <p className="font-medium">{type === 'material' ? tItems('materialTitle') : tItems('expensesTitle')}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words">
                        {formatQuantity(item.quantity)}× {item.description}
                      </span>
                      {item.unitPriceRappen > 0 && (
                        <span className="shrink-0 tabular-nums">CHF {formatChf(Math.round(item.quantity * item.unitPriceRappen))}</span>
                      )}
                    </li>
                  ))}
                  {items.length > 1 && (
                    <li className="flex justify-between gap-3 border-t border-zinc-200 dark:border-zinc-700 pt-0.5 font-medium">
                      <span>{tItems('total')}</span>
                      <span className="tabular-nums">CHF {formatChf(itemsTotalRappen(items))}</span>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
          {canManage && creatorName && (
            <p>
              <span className="font-medium">{t('employeeLabel')}:</span> {creatorName}
            </p>
          )}
          {recordedByName && (
            <p>
              <span className="font-medium">{t('createdByLabel')}</span> {recordedByName}
            </p>
          )}
        </div>
      </div>

      {lockedHint && (
        <span
          className="ml-4 flex-shrink-0 p-2 text-zinc-400 dark:text-zinc-500"
          title={lockedHint}
          aria-label={lockedHint}
          role="img"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </span>
      )}
      {(canEdit || canDelete) && (
        <div className="flex gap-2 ml-4 flex-shrink-0">
          {canEdit && (
            <button
              onClick={() => onEdit(entry)}
              className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors"
              title={tCommon('edit')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(entry.id)}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
              title={tCommon('delete')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MyEntries: FC = () => {
  const { isAdmin, userProfile } = useAuth();
  const { organizations, selectedOrgId, setSelectedOrgId, canManageSelectedOrganization } = useOrganization();
  const t = useTranslations('myEntries');
  const tItems = useTranslations('entryItems');
  const tCommon = useTranslations('common');
  const getApiErrorMessage = useApiErrorMessage();
  // Admin/Owner: alles. Mitarbeiter: eigene Eintraege nur in der laufenden
  // Woche (aeltere sind gesperrt - siehe Backend assertCanModifyTimeEntry).
  // Vom Admin/Owner fuer den Mitarbeiter erfasste Eintraege sind fuer ihn
  // ebenfalls gesperrt.
  const lockedHint = (entry: TimeEntry): string | null => {
    if (canManageSelectedOrganization || entry.creatorId !== userProfile?.id) return null;
    if (entry.createdBy) return t('lockedByManagerHint');
    return isInCurrentWeek(entry.startAt) ? null : t('lockedHint');
  };
  const canEditEntry = (entry: TimeEntry) =>
    canManageSelectedOrganization ||
    (entry.creatorId === userProfile?.id && !entry.createdBy && isInCurrentWeek(entry.startAt));
  const { toasts, showToast, removeToast } = useToast();

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRequestRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const dateLocale = useDateLocale();

  // Mitarbeiterauswahl (nur Admin/Owner): '' = alle Personen der Organisation.
  // Ohne eigene Auswahl sind die eigenen Eintraege vorausgewaehlt. Die Auswahl
  // gilt nur fuer die Organisation, in der sie getroffen wurde - so faellt sie
  // beim Organisationswechsel ohne zusaetzlichen Ladevorgang weg.
  const [members, setMembers] = useState<OrganizationMemberDetail[]>([]);
  const [creatorFilter, setCreatorFilter] = useState<{ orgId: string; creatorId: string } | null>(null);
  const hasExplicitCreatorFilter = canManageSelectedOrganization && creatorFilter?.orgId === selectedOrgId;
  const creatorId = !canManageSelectedOrganization
    ? undefined
    : hasExplicitCreatorFilter
      ? creatorFilter.creatorId || undefined
      : userProfile?.id;

  useEffect(() => {
    if (!canManageSelectedOrganization || !selectedOrgId || !getApiBaseUrlOrNull()) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    getOrganizationMembers(selectedOrgId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch((err) => {
        console.error('Fehler beim Laden der Mitglieder:', err);
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageSelectedOrganization, selectedOrgId]);

  const memberOptions = useMemo(
    () =>
      members
        .map((m) => ({
          id: m.userId,
          name: personName(m.user, '?'),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, dateLocale)),
    [members, dateLocale],
  );

  // Kalender ist die Standardansicht; Umschalten auf die Liste bleibt moeglich.
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  // Im Kalender gewaehlter Tag - dessen Eintraege werden darunter vollstaendig
  // aufgelistet (Standard: heute).
  const [selectedDay, setSelectedDay] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  // Kalenderansicht: laedt genau den sichtbaren Monat/die sichtbare Woche.
  const [calendarEntries, setCalendarEntries] = useState<TimeEntry[]>([]);
  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null);
  const handleVisibleRangeChange = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setCalendarRange({ start: start.toISOString(), end: end.toISOString() });
    // Gewaehlten Tag verwerfen, wenn er nach dem Blaettern nicht mehr sichtbar ist.
    setSelectedDay((day) => (day && day >= start && day <= end ? day : null));
  }, []);

  const dayGroups = useMemo(() => groupByDay(entries), [entries]);
  const calendarEvents = useMemo(
    () =>
      calendarEntries.map((entry) => ({
        id: entry.id,
        title: `${entry.project.customerName} - ${entry.project.title}`,
        start: entry.startAt,
        end: entry.endAt,
        color: projectColor(entry.project.customerNumber, entry.project.number),
      })),
    [calendarEntries],
  );

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const emptyEditForm = () => ({
    categoryId: '',
    date: '',
    startTime: '',
    endTime: '',
    comment: '',
    travel: '',
    materials: withTrailingEmptyRow([]) as ItemRow[],
    expenses: withTrailingEmptyRow([]) as ItemRow[],
  });
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [presets, setPresets] = useState<ItemPreset[]>([]);
  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    getItemPresets(selectedOrgId)
      .then((list) => {
        if (!cancelled) setPresets(list);
      })
      .catch(() => {
        if (!cancelled) setPresets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      categoryId: entry.categoryId ?? '',
      date: toDateInputValue(entry.startAt),
      startTime: toTimeInputValue(entry.startAt),
      endTime: toTimeInputValue(entry.endAt),
      comment: entry.comment ?? '',
      travel: minutesToDecimalInput(entry.travelMinutes),
      materials: itemsToRows(entry.items, 'material'),
      expenses: itemsToRows(entry.items, 'expense'),
    });
    getProjectDetail(entry.projectId)
      .then((detail) => setEditCategories(detail.categories))
      .catch(() => setEditCategories([]));
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setEditCategories([]);
    setEditForm(emptyEditForm());
  };

  const handleSaveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEntry) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const startAt = new Date(`${editForm.date}T${editForm.startTime}:00`).toISOString();
      const endAt = new Date(`${editForm.date}T${editForm.endTime}:00`).toISOString();
      const materials = rowsToItems(editForm.materials, 'material');
      const expenses = rowsToItems(editForm.expenses, 'expense');
      const travelMinutes = parseDecimalHours(editForm.travel);
      if (!materials || !expenses || travelMinutes === undefined) {
        setError(travelMinutes === undefined ? t('travelInvalid') : tItems('invalid'));
        setIsSubmitting(false);
        return;
      }
      const updated = await updateTimeEntry(editingEntry.id, {
        categoryId: editForm.categoryId || null,
        startAt,
        endAt,
        comment: editForm.comment.trim() || null,
        travelMinutes,
        items: [...materials, ...expenses],
      });
      const applyUpdate = (prev: TimeEntry[]) =>
        prev.map((entry) => (entry.id === editingEntry.id ? { ...entry, ...updated } : entry));
      setEntries(applyUpdate);
      setCalendarEntries(applyUpdate);
      handleCancelEdit();
      showToast(t('updateSuccess'), 'success');
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Zeiteintrags:', err);
      setError(getApiErrorMessage(err, t('updateErrorGeneric')));
      showToast(t('updateErrorToast'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTimeEntry(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      setCalendarEntries((prev) => prev.filter((entry) => entry.id !== id));
      showToast(t('deleteSuccess'), 'success');
    } catch (err) {
      console.error('Fehler beim Löschen des Zeiteintrags:', err);
      showToast(getApiErrorMessage(err, t('deleteErrorToast')), 'error');
    }
  };

  // Erste Seite (neueste zuerst) laden, wenn die Organisation oder die
  // Mitarbeiterauswahl wechselt.
  // Weitere Seiten kommen ueber loadMore beim Scrollen.
  useEffect(() => {
    if (!getApiBaseUrlOrNull() || !selectedOrgId) return;

    const requestRef = listRequestRef;
    const requestId = ++requestRef.current;
    const controller = new AbortController();
    loadingMoreRef.current = false;

    const fetchFirstPage = async () => {
      setIsLoading(true);
      setIsLoadingMore(false);
      setLoadMoreError(false);
      setError(null);

      try {
        const page = await getTimeEntries(selectedOrgId, { limit: PAGE_SIZE, creatorId, signal: controller.signal });
        if (requestId !== listRequestRef.current) return;
        setEntries(page.timeEntries);
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (requestId !== listRequestRef.current) return;
        console.error('Fehler beim Laden der Zeiteinträge:', err);
        setEntries([]);
        setNextCursor(null);
        setError(t('loadError'));
      } finally {
        if (requestId === listRequestRef.current) setIsLoading(false);
      }
    };

    fetchFirstPage();

    return () => {
      requestRef.current++;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, creatorId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || !selectedOrgId || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const requestId = listRequestRef.current;
    setIsLoadingMore(true);
    setLoadMoreError(false);

    try {
      const page = await getTimeEntries(selectedOrgId, { limit: PAGE_SIZE, cursor: nextCursor, creatorId });
      if (requestId !== listRequestRef.current) return;

      setEntries((prev) => {
        const known = new Set(prev.map((e) => e.id));
        const fresh = page.timeEntries.filter((e) => !known.has(e.id));
        return [...prev, ...fresh];
      });
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      console.error('Fehler beim Nachladen der Zeiteinträge:', err);
      setLoadMoreError(true);
    } finally {
      if (requestId === listRequestRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [nextCursor, selectedOrgId, creatorId]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || isLoading || isLoadingMore || loadMoreError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, isLoading, isLoadingMore, loadMoreError, loadMore]);

  // Kalenderansicht: genau den sichtbaren Monat/die sichtbare Woche laden
  // (ohne limit - der Zeitraum ist von sich aus klein).
  useEffect(() => {
    if (view !== 'calendar' || !calendarRange) return;
    if (!getApiBaseUrlOrNull() || !selectedOrgId) return;

    const controller = new AbortController();
    let cancelled = false;

    const fetchVisibleRange = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const page = await getTimeEntries(selectedOrgId, {
          startDate: calendarRange.start,
          endDate: calendarRange.end,
          creatorId,
          signal: controller.signal,
        });
        if (cancelled) return;
        setCalendarEntries(page.timeEntries);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (cancelled) return;
        console.error('Fehler beim Laden der Zeiteinträge:', err);
        setError(t('loadError'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchVisibleRange();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedOrgId, calendarRange, creatorId]);

  const selectedDayGroup = useMemo(() => {
    if (!selectedDay) return null;
    const key = selectedDay.toDateString();
    const dayEntries = calendarEntries.filter((entry) => new Date(entry.startAt).toDateString() === key);
    return groupByDay(dayEntries)[0] ?? { key, date: selectedDay, entries: [], totalMinutes: 0 };
  }, [selectedDay, calendarEntries]);

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {canManageSelectedOrganization ? t('titleManager') : t('title')}
          </h1>
          {canManageSelectedOrganization && (
            <a
              href={creatorId ? `/reports?creatorId=${creatorId}` : '/reports'}
              className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {t('reportButton')}
            </a>
          )}
        </div>
        <div className="flex flex-col gap-2 mt-2">
          {isAdmin && organizations.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="entriesOrgSelect" className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                {tCommon('organizationLabel')}:
              </label>
              <select
                id="entriesOrgSelect"
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="flex-1 sm:flex-initial px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canManageSelectedOrganization && memberOptions.length > 1 && (
            <div className="flex items-center gap-2">
              <label htmlFor="entriesCreatorSelect" className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                {t('employeeLabel')}:
              </label>
              <select
                id="entriesCreatorSelect"
                value={creatorId ?? ''}
                onChange={(e) => selectedOrgId && setCreatorFilter({ orgId: selectedOrgId, creatorId: e.target.value })}
                className="flex-1 min-w-0 sm:flex-initial px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('allEmployees')}</option>
                {memberOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {isLoading
                ? t('loadingEntries')
                : view === 'calendar'
                  ? t('entriesFoundCount', { count: calendarEntries.length })
                  : nextCursor
                    ? t('entriesShownCountMore', { count: entries.length })
                    : t('entriesFoundCount', { count: entries.length })}
            </p>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setView('calendar')} className={`px-2 sm:px-3 py-1 text-sm rounded ${view === 'calendar' ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}>{t('calendarView')}</button>
              <button onClick={() => setView('list')} className={`px-2 sm:px-3 py-1 text-sm rounded ${view === 'list' ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}>{t('listView')}</button>
            </div>
          </div>
        </div>
        {error && (view === 'calendar' ? calendarEntries : entries).length === 0 && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 mt-3">
            <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
          </div>
        )}
      </div>

      {editingEntry && (() => {
        const canEditEditingEntry = canEditEntry(editingEntry);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {canEditEditingEntry ? t('editEntry') : t('viewEntry')}
                  </h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                    {editingEntry.project.customerName} - {editingEntry.project.title}
                  </p>
                </div>
                <button onClick={handleCancelEdit} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-5">
                {editCategories.length > 0 && (
                  <div className="space-y-2">
                    <label htmlFor="edit-category" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('categoryLabel')}
                    </label>
                    <select
                      id="edit-category"
                      value={editForm.categoryId}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                      className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
                      disabled={!canEditEditingEntry}
                    >
                      <option value="">{t('noCategoryOption')}</option>
                      <CategoryOptions categories={editCategories} />
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="edit-date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t('dateLabel')}
                  </label>
                  <DateInput
                    id="edit-date"
                    value={editForm.date}
                    onChange={(date) => setEditForm((prev) => ({ ...prev, date }))}
                    required
                    disabled={!canEditEditingEntry}
                    min={canManageSelectedOrganization ? undefined : currentWeekStartKey()}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="edit-startTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('startTimeLabel')}
                    </label>
                    <TimeInput
                      id="edit-startTime"
                      value={editForm.startTime}
                      onChange={(startTime) => setEditForm((prev) => ({ ...prev, startTime }))}
                      required
                      disabled={!canEditEditingEntry}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="edit-endTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('endTimeLabel')}
                    </label>
                    <TimeInput
                      id="edit-endTime"
                      value={editForm.endTime}
                      onChange={(endTime) => setEditForm((prev) => ({ ...prev, endTime }))}
                      required
                      disabled={!canEditEditingEntry}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="edit-travel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t('travelInputLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="edit-travel"
                      type="text"
                      inputMode="decimal"
                      value={editForm.travel}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, travel: e.target.value }))}
                      placeholder="0.00"
                      disabled={!canEditEditingEntry}
                      className="w-28 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 tabular-nums disabled:opacity-60"
                    />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">h</span>
                  </div>
                </div>

                <EntryItemsEditor
                  idPrefix="edit-material"
                  title={tItems('materialTitle')}
                  rows={editForm.materials}
                  onChange={(materials) => setEditForm((prev) => ({ ...prev, materials }))}
                  presets={presets.filter((p) => p.type === 'material')}
                  disabled={!canEditEditingEntry}
                />
                <EntryItemsEditor
                  idPrefix="edit-expense"
                  title={tItems('expensesTitle')}
                  rows={editForm.expenses}
                  onChange={(expenses) => setEditForm((prev) => ({ ...prev, expenses }))}
                  presets={presets.filter((p) => p.type === 'expense')}
                  disabled={!canEditEditingEntry}
                />

                <div className="space-y-2">
                  <label htmlFor="edit-comment" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t('editCommentLabel')}
                  </label>
                  <textarea
                    id="edit-comment"
                    rows={2}
                    maxLength={1000}
                    value={editForm.comment}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, comment: e.target.value }))}
                    className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
                    disabled={!canEditEditingEntry}
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  {canEditEditingEntry && (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 rounded-lg bg-brown-600 hover:bg-brown-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 font-medium text-white transition-colors"
                    >
                      {isSubmitting ? t('saving') : t('saveChanges')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                    className={`${canEditEditingEntry ? '' : 'flex-1'} px-6 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50`}
                  >
                    {canEditEditingEntry ? tCommon('cancel') : tCommon('close')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {view === 'calendar' ? (
        // Immer gemountet (auch waehrend des Ladens), sonst ginge beim Blaettern
        // der gewaehlte Monat verloren.
        <div className="space-y-4">
          <CalendarView
            events={calendarEvents}
            selectedDate={selectedDay}
            onSelectDate={setSelectedDay}
            onVisibleRangeChange={handleVisibleRangeChange}
          />
          {selectedDayGroup ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 pb-1">
                <h2 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {selectedDayGroup.date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h2>
                {selectedDayGroup.entries.length > 0 && (
                  <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400">
                    {t('dayTotal', { duration: `${formatDecimalHours(selectedDayGroup.totalMinutes)} h` })}
                  </span>
                )}
              </div>
              <DayCostLine entries={selectedDayGroup.entries} />
              {selectedDayGroup.entries.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{isLoading ? t('loadingEntriesEllipsis') : t('noEntriesOnDay')}</p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {selectedDayGroup.entries.map((entry) => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      onEdit={handleEdit}
                      onDelete={(id) => setConfirmDeleteId(id)}
                      canManage={canManageSelectedOrganization}
                      canEdit={canEditEntry(entry)}
                      canDelete={canEditEntry(entry)}
                      lockedHint={lockedHint(entry)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('selectDayHint')}</p>
          )}
        </div>
      ) : isLoading ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-4 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t('loadingEntriesEllipsis')}</p>
        </div>
      ) : entries.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5">
            {dayGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 pb-1">
                  <h2 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {group.date.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h2>
                  <span className="shrink-0 text-sm text-zinc-600 dark:text-zinc-400">
                    {t('dayTotal', { duration: `${formatDecimalHours(group.totalMinutes)} h` })}
                  </span>
                </div>
                <DayCostLine entries={group.entries} />
                <div className="grid grid-cols-1 gap-3">
                  {group.entries.map((entry) => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      onEdit={handleEdit}
                      onDelete={(id) => setConfirmDeleteId(id)}
                      canManage={canManageSelectedOrganization}
                      canEdit={canEditEntry(entry)}
                      canDelete={canEditEntry(entry)}
                      lockedHint={lockedHint(entry)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {nextCursor && (
            <div ref={sentinelRef} className="py-4 text-center">
              {loadMoreError ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-600 dark:text-red-400">{t('loadError')}</p>
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    className="px-4 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    {t('loadMore')}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('loadingMore')}</p>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t('noEntriesFound')}</p>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {confirmDeleteId !== null && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMessage')}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </section>
  );
};

export default MyEntries;
