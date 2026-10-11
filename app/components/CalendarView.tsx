'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';

// Kalenderansicht (Monat/Woche) - portiert aus FleetTrack (CalendarView), hier
// mit Uebersetzungen und lokalisierten Wochentagen/Monatsnamen.

export interface CalendarEvent {
  id: string | number;
  title: string;
  start: string; // ISO
  end: string;
}

interface Props {
  events: CalendarEvent[];
  onEventClick?: (eventId: string | number) => void;
  // Meldet den aktuell sichtbaren Zeitraum (inkl. angrenzender Tage im
  // Monatsraster) beim Anzeigen und bei jedem Blaettern/Moduswechsel, damit
  // der Aufrufer genau dafuer die Ereignisse nachladen kann.
  onVisibleRangeChange?: (range: { start: Date; end: Date }) => void;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export default function CalendarView({ events, onEventClick, onVisibleRangeChange }: Props) {
  const t = useTranslations('calendar');
  const dateLocale = useDateLocale();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const today = new Date();

  // Kurze Wochentagsnamen Mo-So in der aktuellen Sprache (05.01.2026 = Montag).
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2026, 0, 5 + i).toLocaleDateString(dateLocale, { weekday: 'short' }),
      ),
    [dateLocale],
  );

  const monthRange = useMemo(() => {
    const start = startOfMonth(cursor);
    const startWeekDay = (start.getDay() + 6) % 7; // Montag = 0
    const gridStart = addDays(start, -startWeekDay);
    const end = endOfMonth(cursor);
    const endWeekDay = (end.getDay() + 6) % 7;
    const gridEnd = addDays(end, 6 - endWeekDay);

    const days: Date[] = [];
    for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [cursor]);

  const weekRange = useMemo(() => {
    const weekStart = addDays(cursor, -((cursor.getDay() + 6) % 7));
    const days = [] as Date[];
    for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
    return days;
  }, [cursor]);

  const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
  useEffect(() => {
    onVisibleRangeChangeRef.current = onVisibleRangeChange;
  }, [onVisibleRangeChange]);

  const visibleDays = mode === 'month' ? monthRange : weekRange;
  const visibleStartMs = visibleDays[0].getTime();
  const visibleEndMs = visibleDays[visibleDays.length - 1].getTime();
  useEffect(() => {
    const start = new Date(visibleStartMs);
    start.setHours(0, 0, 0, 0);
    const end = new Date(visibleEndMs);
    end.setHours(23, 59, 59, 999);
    onVisibleRangeChangeRef.current?.({ start, end });
  }, [visibleStartMs, visibleEndMs]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      for (let d = new Date(s); d <= e; d = addDays(d, 1)) {
        const key = d.toDateString();
        const list = map.get(key) ?? [];
        list.push(ev);
        map.set(key, list);
      }
    });
    map.forEach((list) => list.sort((a, b) => a.start.localeCompare(b.start)));
    return map;
  }, [events]);

  const gotoPrev = () => setCursor((c) => (mode === 'month' ? new Date(c.getFullYear(), c.getMonth() - 1, 1) : addDays(c, -7)));
  const gotoNext = () => setCursor((c) => (mode === 'month' ? new Date(c.getFullYear(), c.getMonth() + 1, 1) : addDays(c, 7)));
  const gotoToday = () => setCursor(new Date());

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Kopfzeile - auf Mobile gestapelt, ab sm nebeneinander */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2">
          <div className="flex gap-1 sm:gap-2">
            <button onClick={gotoPrev} aria-label={t('previous')} className="px-2 sm:px-3 py-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">&lt;</button>
            <button onClick={gotoToday} className="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">{t('today')}</button>
            <button onClick={gotoNext} aria-label={t('next')} className="px-2 sm:px-3 py-1 text-sm rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">&gt;</button>
          </div>
          <h2 className="text-base sm:text-lg font-medium sm:hidden">{cursor.toLocaleString(dateLocale, { month: 'short', year: 'numeric' })}</h2>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          <h2 className="hidden sm:block text-lg font-medium">{cursor.toLocaleString(dateLocale, { month: 'long', year: 'numeric' })}</h2>
          <div className="flex gap-1 sm:gap-2">
            <button onClick={() => setMode('month')} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded ${mode === 'month' ? 'bg-zinc-200 dark:bg-zinc-700' : 'bg-transparent border border-zinc-300 dark:border-zinc-600'}`}>{t('month')}</button>
            <button onClick={() => setMode('week')} className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded ${mode === 'week' ? 'bg-zinc-200 dark:bg-zinc-700' : 'bg-transparent border border-zinc-300 dark:border-zinc-600'}`}>{t('week')}</button>
          </div>
        </div>
      </div>

      {mode === 'month' ? (
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {weekdayLabels.map((h) => (
            <div key={h} className="text-center text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400 py-1">{h}</div>
          ))}
          {monthRange.map((d) => {
            const key = d.toDateString();
            const evs = eventsByDay.get(key) ?? [];
            const inMonth = d.getMonth() === cursor.getMonth();
            return (
              <div key={key} className={`min-w-0 min-h-[60px] sm:min-h-[90px] border border-zinc-200 dark:border-zinc-700 rounded p-1 sm:p-2 ${inMonth ? '' : 'text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50'}`}>
                <div className={`text-[10px] sm:text-xs font-semibold ${isSameDay(d, today) ? 'text-blue-600 dark:text-blue-400' : ''}`}>{d.getDate()}</div>
                <div className="mt-0.5 sm:mt-1 space-y-0.5 sm:space-y-1">
                  {evs.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      className="text-[9px] sm:text-xs bg-blue-50 dark:bg-blue-900/30 rounded px-0.5 sm:px-1 py-0.5 truncate cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      onClick={() => onEventClick?.(ev.id)}
                      title={ev.title}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {evs.length > 2 && <div className="text-[9px] sm:text-xs text-zinc-500">+{evs.length - 2}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {weekRange.map((d) => (
            <div key={d.toDateString()} className="min-w-0 min-h-[80px] sm:min-h-[120px] border border-zinc-200 dark:border-zinc-700 rounded p-1 sm:p-2">
              <div className={`text-[10px] sm:text-xs font-semibold ${isSameDay(d, today) ? 'text-blue-600 dark:text-blue-400' : ''}`}>{d.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric' })}</div>
              <div className="mt-1 sm:mt-2 space-y-0.5 sm:space-y-1">
                {(eventsByDay.get(d.toDateString()) ?? []).map((ev) => (
                  <div
                    key={ev.id}
                    className="text-[9px] sm:text-sm bg-blue-50 dark:bg-blue-900/30 rounded px-0.5 sm:px-1 py-0.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    onClick={() => onEventClick?.(ev.id)}
                    title={ev.title}
                  >
                    <span className="block truncate">{ev.title}</span>
                    <span className="hidden sm:inline text-xs text-zinc-500">{formatTime(ev.start)}–{formatTime(ev.end)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
