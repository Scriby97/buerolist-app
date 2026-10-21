'use client';

import { useRef, type FC } from 'react';

interface DateInputProps {
  id: string;
  /** ISO-Datum (YYYY-MM-DD), wie bei <input type="date">. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Fruehestes waehlbares Datum (YYYY-MM-DD) im nativen Kalender. */
  min?: string;
}

// "2026-10-11" -> "11.10.2026". Bewusst ohne Date-Objekt, damit keine
// Zeitzonen-Verschiebung um einen Tag entstehen kann.
export function formatDateCH(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '';
  return `${day}.${month}.${year}`;
}

/**
 * Datumsfeld mit fixem Schweizer Format (TT.MM.JJJJ). Ein natives
 * <input type="date"> zeigt das Datum im Format der Browser-/OS-Sprache an
 * (z.B. 11/10/2026) und laesst sich nicht umstellen. Daher liegt das native
 * Feld unsichtbar ueber einer eigenen Anzeige - der native Kalender-Picker
 * bleibt erhalten.
 */
export const DateInput: FC<DateInputProps> = ({ id, value, onChange, required, disabled, min }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (disabled) return;
    try {
      inputRef.current?.showPicker();
    } catch {
      // showPicker nicht unterstuetzt - Klick auf das native Feld genuegt dann.
    }
  };

  return (
    <div
      onClick={openPicker}
      className={`relative flex w-full items-center justify-between rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      {/* Geschuetztes Leerzeichen haelt bei leerem Wert die Zeilenhoehe. */}
      <span>{value ? formatDateCH(value) : ' '}</span>
      <svg
        className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <input
        ref={inputRef}
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full opacity-0 [&::-webkit-calendar-picker-indicator]:hidden"
        required={required}
        disabled={disabled}
        min={min}
      />
    </div>
  );
};
