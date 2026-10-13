'use client';

import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslations } from 'next-intl';

interface TimeInputProps {
  id: string;
  /** Uhrzeit "HH:MM" (24 h) oder '' - gleiches Format wie <input type="time">. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => pad2(h));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad2(i * 5));

/**
 * Freie Eingabe -> "HH:MM" (24 h) oder null, wenn nicht interpretierbar.
 * Akzeptiert z.B. "7" -> 07:00, "730" -> 07:30, "1730" -> 17:30,
 * "7:30" / "7.30" -> 07:30.
 */
export function parseTime(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let hours: number;
  let minutes: number;
  const separated = text.match(/^(\d{1,2})[:.,h ](\d{1,2})$/);
  if (separated) {
    hours = Number(separated[1]);
    minutes = Number(separated[2]);
  } else if (/^\d{1,4}$/.test(text)) {
    if (text.length <= 2) {
      hours = Number(text);
      minutes = 0;
    } else {
      hours = Number(text.slice(0, text.length - 2));
      minutes = Number(text.slice(-2));
    }
  } else {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Uhrzeitfeld mit festem 24-h-Format. Ein natives <input type="time"> zeigt
 * je nach Browser-/OS-Sprache AM/PM an und laesst sich nicht umstellen -
 * daher ein Textfeld (direkt tippbar) plus eigene Stunden/Minuten-Auswahl.
 */
export const TimeInput: FC<TimeInputProps> = ({ id, value, onChange, required, disabled }) => {
  const t = useTranslations('timeInput');
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  // Von aussen geaenderten Wert (z.B. vorgeschlagene Startzeit) uebernehmen.
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  const [selectedHour, selectedMinute] = value ? value.split(':') : ['', ''];

  const commitText = () => {
    if (!text.trim()) {
      if (value) onChange('');
      return;
    }
    const parsed = parseTime(text);
    if (parsed) {
      setText(parsed);
      if (parsed !== value) onChange(parsed);
    } else {
      setText(value);
    }
  };

  // Auswahl schliessen bei Klick ausserhalb oder Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Beim Oeffnen die gewaehlte (bzw. eine sinnvolle) Zeit in die Mitte scrollen.
  useEffect(() => {
    if (!open) return;
    const center = (container: HTMLDivElement | null, key: string) => {
      const item = container?.querySelector<HTMLElement>(`[data-value="${key}"]`);
      if (container && item) {
        container.scrollTop = item.offsetTop - container.clientHeight / 2 + item.clientHeight / 2;
      }
    };
    center(hoursRef.current, selectedHour || '07');
    center(minutesRef.current, selectedMinute ? pad2(Math.round(Number(selectedMinute) / 5) * 5 % 60) : '00');
  }, [open, selectedHour, selectedMinute]);

  const pickHour = (hour: string) => onChange(`${hour}:${selectedMinute || '00'}`);
  const pickMinute = (minute: string) => {
    onChange(`${selectedHour || '00'}:${minute}`);
    setOpen(false);
  };

  const itemClass = (selected: boolean) =>
    `block w-full rounded-md px-3 py-1.5 text-center text-sm tabular-nums transition-colors ${
      selected
        ? 'bg-blue-600 text-white'
        : 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'
    }`;

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="--:--"
        maxLength={5}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          // Vollstaendige Eingabe sofort uebernehmen (fuer Validierung/Vorschlaege).
          const parsed = /^\d{1,2}[:.]\d{2}$/.test(next.trim()) ? parseTime(next) : null;
          if (parsed && parsed !== value) onChange(parsed);
        }}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitText();
        }}
        required={required}
        disabled={disabled}
        className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2 pl-4 pr-11 tabular-nums text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-label={t('openPicker')}
        aria-expanded={open}
        title={t('openPicker')}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:cursor-not-allowed"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 flex w-44 gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1 shadow-lg">
          <div ref={hoursRef} role="listbox" aria-label={t('hours')} className="max-h-56 flex-1 overflow-y-auto">
            {HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                role="option"
                aria-selected={hour === selectedHour}
                data-value={hour}
                onClick={() => pickHour(hour)}
                className={itemClass(hour === selectedHour)}
              >
                {hour}
              </button>
            ))}
          </div>
          <div ref={minutesRef} role="listbox" aria-label={t('minutes')} className="max-h-56 flex-1 overflow-y-auto">
            {MINUTES.map((minute) => (
              <button
                key={minute}
                type="button"
                role="option"
                aria-selected={minute === selectedMinute}
                data-value={minute}
                onClick={() => pickMinute(minute)}
                className={itemClass(minute === selectedMinute)}
              >
                {minute}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
