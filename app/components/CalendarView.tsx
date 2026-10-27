'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import { colorVars, ENTITY_BG, type EntityColor } from '@/lib/colors/entityColors';
import { formatDecimalHours } from '@/lib/format/hours';

// Kalenderansicht (Monat/Woche) - urspruenglich aus FleetTrack portiert. Die
// Tage zeigen nur eine Uebersicht (Tagestotal + Anzahl Eintraege) und sind
// antippbar; die Eintraege des gewaehlten Tages listet der Aufrufer darunter
// vollstaendig auf - so bleiben auch 5+ Eintraege pro Tag lesbar/klickbar,
// auch auf schmalen Handy-Bildschirmen.

export interface CalendarEvent {
  id: string | number;
  title: string;
  start: string; // ISO
  end: string;
  /** Erkennungsfarbe des Projekts (Punkt im Tagesfeld) */
  color?: EntityColor;
}

interface Props {
  events: CalendarEvent[];
  /** Aktuell gewaehlter Tag (hervorgehoben), null = keiner. */
  selectedDate?: Date | null;
  /** Tipp auf einen Tag bzw. "Heute". */
  onSelectDate?: (date: Date) => void;
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

export default function CalendarView({ events, selectedDate, onSelectDate, onVisibleRangeChange }: Props) {
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

  // Pro Tag: Anzahl Eintraege und Summe der Minuten (Eintraege gehen nicht
  // ueber Mitternacht - der Starttag zaehlt).
  const summaryByDay = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number; colors: (EntityColor | undefined)[] }>();
    [...events]
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((ev) => {
        const key = new Date(ev.start).toDateString();
        const minutes = Math.max(0, Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60_000));
        const current = map.get(key) ?? { count: 0, minutes: 0, colors: [] };
        map.set(key, { count: current.count + 1, minutes: current.minutes + minutes, colors: [...current.colors, ev.color] });
      });
    return map;
  }, [events]);

  const gotoPrev = () => setCursor((c) => (mode === 'month' ? new Date(c.getFullYear(), c.getMonth() - 1, 1) : addDays(c, -7)));
  const gotoNext = () => setCursor((c) => (mode === 'month' ? new Date(c.getFullYear(), c.getMonth() + 1, 1) : addDays(c, 7)));
  const gotoToday = () => {
    const now = new Date();
    setCursor(now);
    onSelectDate?.(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  };


  const renderDay = (d: Date, label: string, dimmed: boolean, tall: boolean) => {
    const key = d.toDateString();
    const summary = summaryByDay.get(key);
    const isSelected = !!selectedDate && isSameDay(d, selectedDate);
    const isToday = isSameDay(d, today);
    const ariaLabel = [
      d.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }),
      summary ? t('dayEntries', { count: summary.count, total: formatDecimalHours(summary.minutes) }) : t('dayNoEntries'),
    ].join(': ');
    return (
      <button
        key={key}
        type="button"
        onClick={() => onSelectDate?.(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
        aria-label={ariaLabel}
        aria-pressed={isSelected}
        className={`min-w-0 ${tall ? 'min-h-[80px] sm:min-h-[110px]' : 'min-h-[56px] sm:min-h-[84px]'} flex flex-col items-stretch rounded border p-1 sm:p-2 text-left transition-colors ${
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-500/40 bg-blue-50 dark:bg-blue-900/30'
            : `border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${dimmed ? 'text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50' : ''}`
        }`}
      >
        <span className={`text-[10px] sm:text-xs font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`}>{label}</span>
        {summary && (
          <span className="mt-auto flex flex-col items-start gap-0.5 sm:gap-1">
            <span className="text-[11px] sm:text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDecimalHours(summary.minutes)}
            </span>
            <span className="flex items-center gap-0.5" aria-hidden="true">
              {/* Ein Punkt pro Eintrag in der Farbe seines Projekts - so sieht man
                  auf einen Blick, an wie vielen Projekten gearbeitet wurde. */}
              {summary.colors.slice(0, 5).map((color, i) =>
                color ? (
                  <span key={i} style={colorVars(color)} className={`h-1.5 w-1.5 rounded-full ${ENTITY_BG}`} />
                ) : (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />
                ),
              )}
              {summary.count > 5 && <span className="text-[9px] sm:text-[10px] leading-none text-zinc-500">+</span>}
            </span>
          </span>
        )}
      </button>
    );
  };

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
          {monthRange.map((d) => renderDay(d, String(d.getDate()), d.getMonth() !== cursor.getMonth(), false))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {weekRange.map((d) =>
            renderDay(d, d.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric' }), false, true),
          )}
        </div>
      )}
    </div>
  );
}
