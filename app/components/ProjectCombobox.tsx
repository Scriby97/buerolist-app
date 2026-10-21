'use client';

import { useEffect, useId, useMemo, useRef, useState, type FC } from 'react';
import { formatProjectNumber } from '@/lib/format/numbers';
import { projectColor } from '@/lib/colors/entityColors';
import { ColorDot } from './ColorDot';

export interface ProjectOption {
  id: string;
  title: string;
  number?: number | null;
  customerName?: string;
  customerNumber?: number | null;
}

interface ProjectComboboxProps {
  id: string;
  options: ProjectOption[];
  value: string;
  onChange: (projectId: string) => void;
  placeholder: string;
  noMatchesText: string;
  disabled?: boolean;
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function searchText(option: ProjectOption): string {
  const number = formatProjectNumber(option.customerNumber, option.number);
  const parts = [option.customerName ?? '', option.title];
  if (number) {
    // "001-12", "00112" und "1-12" sollen alle treffen.
    parts.push(number, number.replace('-', ''), `${option.customerNumber}-${option.number}`);
  }
  return normalize(parts.join(' '));
}

/** Alle Suchwoerter muessen in Nummer, Kundenname oder Projektbezeichnung vorkommen. */
export function filterProjectOptions(options: ProjectOption[], query: string): ProjectOption[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return options;
  return options.filter((option) => {
    const haystack = searchText(option);
    return tokens.every((token) => haystack.includes(token));
  });
}

const optionLabel = (option: ProjectOption) =>
  option.customerName ? `${option.customerName} – ${option.title}` : option.title;

/**
 * Projektauswahl mit Suche (Typeahead): findet Projekte ueber die Nummer
 * ("001-12", "1-12", "00112"), den Kundennamen oder die Projektbezeichnung.
 * Tastatur: Pfeile, Enter, Escape.
 */
export const ProjectCombobox: FC<ProjectComboboxProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder,
  noMatchesText,
  disabled,
}) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const sorted = useMemo(
    () =>
      [...options].sort(
        (a, b) =>
          (a.customerNumber ?? Infinity) - (b.customerNumber ?? Infinity) ||
          (a.number ?? Infinity) - (b.number ?? Infinity) ||
          optionLabel(a).localeCompare(optionLabel(b)),
      ),
    [options],
  );
  const matches = useMemo(() => filterProjectOptions(sorted, query), [sorted, query]);
  const selected = options.find((option) => option.id === value);
  const selectedText = selected
    ? [formatProjectNumber(selected.customerNumber, selected.number), optionLabel(selected)].filter(Boolean).join(' ')
    : '';

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (option: ProjectOption) => {
    onChange(option.id);
    close();
  };

  // Schliessen bei Klick/Tipp ausserhalb.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Aktiven Treffer bei Pfeiltasten sichtbar halten.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  return (
    <div ref={rootRef} className="relative">
      {selected && !open && (
        <ColorDot
          color={projectColor(selected.customerNumber, selected.number)}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
      )}
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : selectedText}
        onFocus={(e) => {
          setOpen(true);
          setQuery('');
          setActiveIndex(Math.max(0, sorted.findIndex((o) => o.id === value)));
          e.target.select();
        }}
        // Nach einer Auswahl bleibt der Fokus im Feld - ein erneuter Klick/Tipp
        // soll die Liste trotzdem wieder oeffnen.
        onClick={() => {
          if (open) return;
          setOpen(true);
          setQuery('');
          setActiveIndex(Math.max(0, sorted.findIndex((o) => o.id === value)));
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            if (open && matches[activeIndex]) {
              e.preventDefault();
              choose(matches[activeIndex]);
            }
          } else if (e.key === 'Escape') {
            close();
          }
        }}
        className={`block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 py-2 ${selected && !open ? 'pl-8' : 'pl-4'} pr-10 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-60`}
      />
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 shadow-lg"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">{noMatchesText}</li>
          ) : (
            matches.map((option, index) => {
              const number = formatProjectNumber(option.customerNumber, option.number);
              const isActive = index === activeIndex;
              const isSelected = option.id === value;
              return (
                <li
                  key={option.id}
                  id={`${listId}-${option.id}`}
                  role="option"
                  aria-selected={isSelected}
                  data-index={index}
                  // mousedown statt click: sonst verliert das Eingabefeld vorher den Fokus.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                    isActive ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                  } ${isSelected ? 'font-semibold' : ''}`}
                >
                  <ColorDot color={projectColor(option.customerNumber, option.number)} />
                  {number && (
                    <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      {number}
                    </span>
                  )}
                  <span className="min-w-0 text-zinc-900 dark:text-zinc-50">{optionLabel(option)}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
};
