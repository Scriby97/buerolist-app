'use client';

import { useState, useEffect, useMemo, useRef, useCallback, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import { getApiBaseUrlOrNull } from '@/lib/api/url';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { getTimeEntries, updateTimeEntry, deleteTimeEntry, type TimeEntry } from '@/lib/api/timeEntries';
import { getProjectDetail } from '@/lib/api/projects';
import type { Category } from '@/lib/api/categories';
import { useToast } from '@/lib/hooks/useToast';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { ToastContainer } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import { DateInput } from './DateInput';
import CalendarView from './CalendarView';

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

// Eintraege (bereits neueste zuerst sortiert) nach lokalem Kalendertag gruppieren.
function groupByDay(entries: TimeEntry[]): DayGroup[] {
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
  return groups;
}

function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().split('T')[0];
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

interface EntryItemProps {
  entry: TimeEntry;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  canManage: boolean;
  canEdit: boolean;
}

const EntryItem: FC<EntryItemProps> = ({ entry, onEdit, onDelete, canManage, canEdit }) => {
  const t = useTranslations('myEntries');
  const tCommon = useTranslations('common');
  const creatorName = entry.creator.firstName || entry.creator.lastName
    ? `${entry.creator.firstName || ''} ${entry.creator.lastName || ''}`.trim()
    : entry.creator.email;

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:shadow-md transition-shadow flex justify-between items-start">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-2">
          <svg className="w-8 h-8 shrink-0 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3" />
            <path d="M21 20c0-2.8-1.9-5.1-4.5-5.8" />
          </svg>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">
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
          {canManage && creatorName && (
            <p>
              <span className="font-medium">{t('createdByLabel')}</span> {creatorName}
            </p>
          )}
        </div>
      </div>

      {(canEdit || canManage) && (
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
          {canManage && (
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
  const tCommon = useTranslations('common');
  const getApiErrorMessage = useApiErrorMessage();
  const canEditEntry = (entry: TimeEntry) =>
    canManageSelectedOrganization || entry.creatorId === userProfile?.id;
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

  const [view, setView] = useState<'list' | 'calendar'>('list');
  // Kalenderansicht: laedt genau den sichtbaren Monat/die sichtbare Woche.
  const [calendarEntries, setCalendarEntries] = useState<TimeEntry[]>([]);
  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null);
  const handleVisibleRangeChange = useCallback(({ start, end }: { start: Date; end: Date }) => {
    setCalendarRange({ start: start.toISOString(), end: end.toISOString() });
  }, []);

  const dayGroups = useMemo(() => groupByDay(entries), [entries]);
  const calendarEvents = useMemo(
    () =>
      calendarEntries.map((entry) => ({
        id: entry.id,
        title: `${entry.project.customerName} - ${entry.project.title}`,
        start: entry.startAt,
        end: entry.endAt,
      })),
    [calendarEntries],
  );

  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editCategories, setEditCategories] = useState<Category[]>([]);
  const [editForm, setEditForm] = useState({ categoryId: '', date: '', startTime: '', endTime: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleEdit = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      categoryId: entry.categoryId ?? '',
      date: toDateInputValue(entry.startAt),
      startTime: toTimeInputValue(entry.startAt),
      endTime: toTimeInputValue(entry.endAt),
    });
    getProjectDetail(entry.projectId)
      .then((detail) => setEditCategories(detail.categories))
      .catch(() => setEditCategories([]));
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setEditCategories([]);
    setEditForm({ categoryId: '', date: '', startTime: '', endTime: '' });
  };

  const handleSaveEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEntry) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const startAt = new Date(`${editForm.date}T${editForm.startTime}:00`).toISOString();
      const endAt = new Date(`${editForm.date}T${editForm.endTime}:00`).toISOString();
      const updated = await updateTimeEntry(editingEntry.id, {
        categoryId: editForm.categoryId || null,
        startAt,
        endAt,
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

  // Erste Seite (neueste zuerst) laden, wenn die Organisation wechselt.
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
        const page = await getTimeEntries(selectedOrgId, { limit: PAGE_SIZE, signal: controller.signal });
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
  }, [selectedOrgId]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || !selectedOrgId || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const requestId = listRequestRef.current;
    setIsLoadingMore(true);
    setLoadMoreError(false);

    try {
      const page = await getTimeEntries(selectedOrgId, { limit: PAGE_SIZE, cursor: nextCursor });
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
  }, [nextCursor, selectedOrgId]);

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
  }, [view, selectedOrgId, calendarRange]);

  const handleEventClick = (eventId: string | number) => {
    const entry = calendarEntries.find((e) => e.id === String(eventId));
    if (entry) handleEdit(entry);
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {t('title')}
        </h1>
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
              <button onClick={() => setView('list')} className={`px-2 sm:px-3 py-1 text-sm rounded ${view === 'list' ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}>{t('listView')}</button>
              <button onClick={() => setView('calendar')} className={`px-2 sm:px-3 py-1 text-sm rounded ${view === 'calendar' ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}>{t('calendarView')}</button>
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
                      {editCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
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
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="edit-startTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('startTimeLabel')}
                    </label>
                    <input
                      id="edit-startTime"
                      type="time"
                      value={editForm.startTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
                      required
                      disabled={!canEditEditingEntry}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="edit-endTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {t('endTimeLabel')}
                    </label>
                    <input
                      id="edit-endTime"
                      type="time"
                      value={editForm.endTime}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
                      required
                      disabled={!canEditEditingEntry}
                    />
                  </div>
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
        <CalendarView
          events={calendarEvents}
          onEventClick={handleEventClick}
          onVisibleRangeChange={handleVisibleRangeChange}
        />
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
                    {t('dayTotal', { duration: formatMinutes(group.totalMinutes) })}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {group.entries.map((entry) => (
                    <EntryItem
                      key={entry.id}
                      entry={entry}
                      onEdit={handleEdit}
                      onDelete={(id) => setConfirmDeleteId(id)}
                      canManage={canManageSelectedOrganization}
                      canEdit={canEditEntry(entry)}
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
