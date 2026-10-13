'use client';

import type { FC } from 'react';
import { formatHoursMinutes } from '@/lib/timeReport/buildTimeMatrix';

interface CategoryEffortChartProps {
  rows: { key: string; label: string; totalMinutes: number }[];
  title: string;
}

/**
 * Horizontales Balkendiagramm "Aufwand pro Kategorie" - nach Stunden
 * sortiert, die aufwaendigste Kategorie farbig hervorgehoben (Emphasis),
 * die uebrigen gedaempft grau. Jeder Balken traegt Stunden + Anteil als
 * Text (Werte nie nur ueber die Farbe); die Matrix darueber ist die
 * Tabellenansicht derselben Zahlen.
 *
 * Farben per dataviz-Validator geprueft: Akzent #2b6199 (hell, Flaeche
 * #ffffff) bzw. #4f93d4 (dunkel, Flaeche #2a323a) gegen das Grau
 * zinc-400/zinc-500 - Helligkeitsband, CVD- und Normalsicht-Abstand bestanden.
 */
export const CategoryEffortChart: FC<CategoryEffortChartProps> = ({ rows, title }) => {
  const sorted = [...rows].sort((a, b) => b.totalMinutes - a.totalMinutes);
  const max = sorted[0]?.totalMinutes ?? 0;
  const total = sorted.reduce((sum, row) => sum + row.totalMinutes, 0);
  if (max === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h3>
      <ul className="space-y-2.5" aria-label={title}>
        {sorted.map((row) => {
          const isTop = row.totalMinutes === max;
          const percent = total > 0 ? Math.round((row.totalMinutes / total) * 100) : 0;
          const widthPercent = (row.totalMinutes / max) * 100;
          return (
            <li key={row.key} title={`${row.label}: ${formatHoursMinutes(row.totalMinutes)} h (${percent} %)`}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className={`truncate ${isTop ? 'font-semibold text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {row.label}
                </span>
                <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
                  <span className={isTop ? 'font-semibold text-zinc-900 dark:text-zinc-50' : ''}>
                    {formatHoursMinutes(row.totalMinutes)}
                  </span>
                  <span className="ml-1.5 text-xs">{percent} %</span>
                </span>
              </div>
              <div className="h-3 w-full" aria-hidden="true">
                <div
                  className={`h-full rounded-r-[4px] ${
                    isTop ? 'bg-[#2b6199] dark:bg-[#4f93d4]' : 'bg-zinc-400 dark:bg-zinc-500'
                  }`}
                  style={{ width: `${Math.max(widthPercent, 1)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
