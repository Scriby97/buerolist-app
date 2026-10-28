'use client';

import { useEffect, useId, useRef, useState, type FC } from 'react';
import { normalizeSearchText, searchTokens } from '@/lib/search';

export interface MultiSelectOption {
  id: string;
  label: string;
}

interface MultiSelectDropdownProps {
  id: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Anzeige, wenn nichts gewaehlt ist */
  emptyText: string;
  searchPlaceholder: string;
  noMatchesText: string;
}

/**
 * Dropdown mit Mehrfachauswahl (Checkboxen) und Suche - bleibt auch bei
 * vielen Eintraegen uebersichtlich. Zugeklappt zeigt es eine Zusammenfassung
 * der Auswahl ("Anna, Beat" bzw. "Anna +3").
 */
export const MultiSelectDropdown: FC<MultiSelectDropdownProps> = ({
  id,
  options,
  selected,
  onChange,
  emptyText,
  searchPlaceholder,
  noMatchesText,
}) => {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Schliessen bei Klick ausserhalb
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const selectedLabels = options.filter((o) => selected.includes(o.id)).map((o) => o.label);
  const summary =
    selectedLabels.length === 0
      ? emptyText
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels[0]} +${selectedLabels.length - 1}`;

  const tokens = searchTokens(query);
  const visible = tokens.length
    ? options.filter((o) => tokens.every((token) => normalizeSearchText(o.label).includes(token)))
    : options;

  const toggle = (optionId: string) =>
    onChange(selected.includes(optionId) ? selected.filter((x) => x !== optionId) : [...selected, optionId]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((prev) => !prev);
          setQuery('');
        }}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-4 py-2.5 text-left text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
      >
        <span className={`truncate ${selectedLabels.length === 0 ? 'text-zinc-500 dark:text-zinc-400' : ''}`}>{summary}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
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
        <div
          id={panelId}
          className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg"
        >
          {options.length > 6 && (
            <div className="border-b border-zinc-100 dark:border-zinc-700 p-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                autoFocus
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
              />
            </div>
          )}
          <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">{noMatchesText}</li>
            ) : (
              visible.map((option) => (
                <li key={option.id} role="option" aria-selected={selected.includes(option.id)}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700">
                    <input
                      type="checkbox"
                      checked={selected.includes(option.id)}
                      onChange={() => toggle(option.id)}
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    {option.label}
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
