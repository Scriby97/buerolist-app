'use client';

import { useId, useState, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { formatChf, parseChfToRappen, parseQuantity, sanitizeDecimalInput } from '@/lib/format/money';
import { isRowEmpty, withTrailingEmptyRow, type ItemRow } from '@/lib/timeEntryItems';
import { formatPresetNumber } from '@/lib/format/numbers';
import type { ItemPreset } from '@/lib/api/itemPresets';
import { normalizeSearchText, searchTokens } from '@/lib/search';

interface EntryItemsEditorProps {
  /** Eindeutiges Praefix fuer die Feld-IDs, z.B. "material" */
  idPrefix: string;
  title: string;
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  disabled?: boolean;
  /** Vordefinierte Positionen dieses Typs (Einstellungen -> Material & Spesen) */
  presets?: ItemPreset[];
}

const invalidClass = 'border-red-500 dark:border-red-500';

const inputClass =
  'block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-60';

/**
 * Material- bzw. Spesen-Positionen: Menge, Bezeichnung, Preis pro Stueck.
 * Es gibt immer genau eine leere Zeile am Ende - sobald man sie ausfuellt,
 * erscheint darunter die naechste. So lassen sich beliebig viele Positionen
 * erfassen.
 */
export const EntryItemsEditor: FC<EntryItemsEditorProps> = ({ idPrefix, title, rows, onChange, disabled, presets = [] }) => {
  const t = useTranslations('entryItems');
  const visibleRows = rows.length > 0 && isRowEmpty(rows[rows.length - 1]) ? rows : withTrailingEmptyRow(rows);

  const updateRow = (index: number, patch: Partial<ItemRow>) => {
    const next = visibleRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    // Nur am Ende eine neue leere Zeile anhaengen; geleerte Zeilen in der
    // Mitte bleiben stehen, bis man sie entfernt (sonst springt der Fokus).
    if (!isRowEmpty(next[next.length - 1])) next.push({ quantity: '', description: '', price: '' });
    onChange(next);
  };

  // Vorlage in die Zeile uebernehmen (danach frei anpassbar): Bezeichnung,
  // Preis der Vorlage (falls vorhanden) und Menge 1, falls noch leer.
  const applyPreset = (index: number, preset: ItemPreset) =>
    updateRow(index, {
      description: preset.description,
      price: preset.unitPriceRappen ? formatChf(preset.unitPriceRappen) : visibleRows[index].price,
      quantity: visibleRows[index].quantity || '1',
    });

  const removeRow = (index: number) => onChange(withTrailingEmptyRow(visibleRows.filter((_, i) => i !== index)));

  const totalRappen = visibleRows.reduce((sum, row) => {
    if (isRowEmpty(row)) return sum;
    const quantity = parseQuantity(row.quantity);
    const price = parseChfToRappen(row.price);
    return quantity !== null && price !== null ? sum + Math.round(quantity * price) : sum;
  }, 0);
  const filledCount = visibleRows.filter((row) => !isRowEmpty(row)).length;

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{title}</legend>

      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_5.5rem_2rem] gap-x-1.5 gap-y-1.5 items-center">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('quantity')}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('description')}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('unitPrice')}</span>
        <span />
        {visibleRows.map((row, index) => {
          const empty = isRowEmpty(row);
          return [
            <input
              key={`${index}-q`}
              id={`${idPrefix}-quantity-${index}`}
              aria-label={`${title} ${index + 1}: ${t('quantity')}`}
              inputMode="decimal"
              autoComplete="off"
              value={row.quantity}
              placeholder={empty ? '' : '1'}
              onChange={(e) => updateRow(index, { quantity: sanitizeDecimalInput(e.target.value, 1) })}
              aria-invalid={!empty && parseQuantity(row.quantity) === null}
              className={`${inputClass} text-right tabular-nums ${!empty && parseQuantity(row.quantity) === null ? invalidClass : ''}`}
            />,
            <DescriptionInput
              key={`${index}-d`}
              id={`${idPrefix}-description-${index}`}
              label={`${title} ${index + 1}: ${t('description')}`}
              value={row.description}
              presets={presets}
              onChange={(description) => updateRow(index, { description })}
              onPick={(preset) => applyPreset(index, preset)}
            />,
            <input
              key={`${index}-p`}
              id={`${idPrefix}-price-${index}`}
              aria-label={`${title} ${index + 1}: ${t('unitPrice')}`}
              inputMode="decimal"
              autoComplete="off"
              value={row.price}
              onChange={(e) => updateRow(index, { price: sanitizeDecimalInput(e.target.value, 2) })}
              aria-invalid={!empty && row.price.trim() !== '' && parseChfToRappen(row.price) === null}
              className={`${inputClass} text-right tabular-nums ${!empty && row.price.trim() !== '' && parseChfToRappen(row.price) === null ? invalidClass : ''}`}
            />,
            empty ? (
              <span key={`${index}-x`} />
            ) : (
              <button
                key={`${index}-x`}
                type="button"
                onClick={() => removeRow(index)}
                aria-label={`${title} ${index + 1}: ${t('remove')}`}
                title={t('remove')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            ),
          ];
        })}
      </div>
      {filledCount > 0 && (
        <p className="text-right text-sm text-zinc-600 dark:text-zinc-400">
          {t('total')}: <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">CHF {formatChf(totalRappen)}</span>
        </p>
      )}
    </fieldset>
  );
};

/** Vorlagen, die zur Eingabe passen (alle Woerter in Nummer oder Bezeichnung). */
export function matchPresets(presets: ItemPreset[], query: string): ItemPreset[] {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return presets;
  return presets.filter((preset) => {
    const haystack = normalizeSearchText(`${formatPresetNumber(preset.type, preset.number)} ${preset.number} ${preset.description}`);
    return tokens.every((token) => haystack.includes(token));
  });
}

interface DescriptionInputProps {
  id: string;
  label: string;
  value: string;
  presets: ItemPreset[];
  onChange: (value: string) => void;
  onPick: (preset: ItemPreset) => void;
}

/**
 * Bezeichnung mit Vorschlaegen: freie Eingabe, oder beim Fokussieren/Tippen
 * eine vordefinierte Position waehlen (Klick, Pfeiltasten + Enter).
 */
const DescriptionInput: FC<DescriptionInputProps> = ({ id, label, value, presets, onChange, onPick }) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Bereits exakt gewaehlte Vorlage nicht nochmals als einzigen Vorschlag zeigen
  const matches = matchPresets(presets, value).filter((p) => p.description !== value);
  const showList = open && matches.length > 0;

  const pick = (preset: ItemPreset) => {
    onPick(preset);
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        id={id}
        aria-label={label}
        // Ohne Vorlagen ein normales Textfeld, sonst Combobox mit Vorschlaegen
        {...(presets.length > 0 && {
          role: 'combobox',
          'aria-autocomplete': 'list' as const,
          'aria-expanded': showList,
          'aria-controls': listId,
          'aria-activedescendant': showList ? `${listId}-${active}` : undefined,
        })}
        autoComplete="off"
        maxLength={200}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(matches[Math.min(active, matches.length - 1)]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={inputClass}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 shadow-lg"
        >
          {matches.map((preset, i) => (
            <li
              key={preset.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown statt click: sonst schliesst onBlur die Liste vorher
              onMouseDown={(e) => {
                e.preventDefault();
                pick(preset);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline gap-2 px-3 py-2 text-sm ${
                i === active ? 'bg-zinc-100 dark:bg-zinc-700' : ''
              }`}
            >
              <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatPresetNumber(preset.type, preset.number)}
              </span>
              <span className="min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-50">{preset.description}</span>
              {preset.unitPriceRappen ? (
                <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  CHF {formatChf(preset.unitPriceRappen)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
