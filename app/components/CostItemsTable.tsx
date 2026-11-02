'use client';

import type { FC } from 'react';
import { useTranslations } from 'next-intl';
import { formatChf, formatQuantity } from '@/lib/format/money';
import type { CostLine } from '@/lib/timeEntryItems';

interface CostItemsTableProps {
  lines: CostLine[];
  /** Druckvariante fuer den Rapport: immer hell, ohne Dark-Mode-Farben */
  print?: boolean;
}

/**
 * Auflistung aller Material- und Spesenpositionen mit Total pro Typ und
 * Gesamttotal. Gleiche Positionen sind bereits zusammengefasst (aggregateItems
 * bzw. costItems vom Server).
 */
export const CostItemsTable: FC<CostItemsTableProps> = ({ lines, print = false }) => {
  const t = useTranslations('entryItems');
  const groups = (['material', 'expense'] as const)
    .map((type) => {
      const typeLines = lines.filter((line) => line.type === type);
      return {
        type,
        title: type === 'material' ? t('materialTitle') : t('expensesTitle'),
        lines: typeLines,
        totalRappen: typeLines.reduce((sum, line) => sum + line.totalRappen, 0),
      };
    })
    .filter((group) => group.lines.length > 0);
  if (groups.length === 0) return null;
  const grandTotal = groups.reduce((sum, group) => sum + group.totalRappen, 0);

  const cell = 'px-1.5 py-1 align-top';
  const num = `${cell} text-right tabular-nums whitespace-nowrap`;
  const muted = print ? 'text-zinc-600' : 'text-zinc-500 dark:text-zinc-400';
  const rowBorder = print ? 'border-t border-zinc-200' : 'border-t border-zinc-100 dark:border-zinc-700/60';
  const sumBorder = print ? 'border-t border-zinc-400' : 'border-t border-zinc-200 dark:border-zinc-600';
  const totalBorder = print ? 'border-t-2 border-zinc-900' : 'border-t-2 border-zinc-200 dark:border-zinc-600';
  const strong = print ? '' : 'text-zinc-900 dark:text-zinc-50';

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className={`text-xs ${muted}`}>
          <th scope="col" className={`${cell} text-right font-medium`}>{t('quantity')}</th>
          <th scope="col" className={`${cell} w-full text-left font-medium`}>{t('description')}</th>
          <th scope="col" className={`${cell} text-right font-medium whitespace-nowrap`}>{t('unitPrice')}</th>
          <th scope="col" className={`${cell} text-right font-medium`}>CHF</th>
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.type} className="break-inside-avoid">
          <tr>
            <th colSpan={4} scope="colgroup" className={`${cell} pt-3 text-left font-semibold ${strong}`}>
              {group.title}
            </th>
          </tr>
          {group.lines.map((line) => (
            <tr key={`${line.description}|${line.unitPriceRappen}`} className={rowBorder}>
              <td className={num}>{formatQuantity(line.quantity)}</td>
              <td className={cell}>{line.description}</td>
              <td className={num}>{line.unitPriceRappen ? formatChf(line.unitPriceRappen) : ''}</td>
              <td className={num}>{line.totalRappen ? formatChf(line.totalRappen) : ''}</td>
            </tr>
          ))}
          <tr className={`${sumBorder} font-semibold ${strong}`}>
            <td className={cell} colSpan={3}>
              {t('total')} {group.title}
            </td>
            <td className={num}>{formatChf(group.totalRappen)}</td>
          </tr>
        </tbody>
      ))}
      {groups.length > 1 && (
        <tfoot>
          <tr className={`${totalBorder} font-bold ${strong}`}>
            <td className={cell} colSpan={3}>
              {t('grandTotal')}
            </td>
            <td className={num}>{formatChf(grandTotal)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
};
