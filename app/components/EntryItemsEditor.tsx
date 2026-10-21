'use client';

import type { FC } from 'react';
import { useTranslations } from 'next-intl';
import { formatChf, parseChfToRappen, parseQuantity } from '@/lib/format/money';
import { isRowEmpty, withTrailingEmptyRow, type ItemRow } from '@/lib/timeEntryItems';

interface EntryItemsEditorProps {
  /** Eindeutiges Praefix fuer die Feld-IDs, z.B. "material" */
  idPrefix: string;
  title: string;
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  disabled?: boolean;
}

const inputClass =
  'block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-60';

/**
 * Material- bzw. Spesen-Positionen: Menge, Bezeichnung, Preis pro Stueck.
 * Es gibt immer genau eine leere Zeile am Ende - sobald man sie ausfuellt,
 * erscheint darunter die naechste. So lassen sich beliebig viele Positionen
 * erfassen.
 */
export const EntryItemsEditor: FC<EntryItemsEditorProps> = ({ idPrefix, title, rows, onChange, disabled }) => {
  const t = useTranslations('entryItems');
  const visibleRows = rows.length > 0 && isRowEmpty(rows[rows.length - 1]) ? rows : withTrailingEmptyRow(rows);

  const updateRow = (index: number, patch: Partial<ItemRow>) => {
    const next = visibleRows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    // Nur am Ende eine neue leere Zeile anhaengen; geleerte Zeilen in der
    // Mitte bleiben stehen, bis man sie entfernt (sonst springt der Fokus).
    if (!isRowEmpty(next[next.length - 1])) next.push({ quantity: '', description: '', price: '' });
    onChange(next);
  };

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
              onChange={(e) => updateRow(index, { quantity: e.target.value })}
              className={`${inputClass} text-right tabular-nums`}
            />,
            <input
              key={`${index}-d`}
              id={`${idPrefix}-description-${index}`}
              aria-label={`${title} ${index + 1}: ${t('description')}`}
              autoComplete="off"
              maxLength={200}
              value={row.description}
              onChange={(e) => updateRow(index, { description: e.target.value })}
              className={inputClass}
            />,
            <input
              key={`${index}-p`}
              id={`${idPrefix}-price-${index}`}
              aria-label={`${title} ${index + 1}: ${t('unitPrice')}`}
              inputMode="decimal"
              autoComplete="off"
              value={row.price}
              onChange={(e) => updateRow(index, { price: e.target.value })}
              className={`${inputClass} text-right tabular-nums`}
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
