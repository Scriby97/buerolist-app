'use client';

import { useState, type FC } from 'react';
import { useTranslations } from 'next-intl';
import type { CategoryGroup } from '@/lib/api/categories';
import { formatCategoryNumber } from '@/lib/categories';

interface CategoryPickerProps {
  groups: CategoryGroup[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Kategorien-Auswahl fuer ein Projekt, gegliedert nach Hauptkategorien.
 * Jede Hauptkategorie ist aufklappbar und hat ein "alle"-Kaestchen - so
 * bleibt die Auswahl auch bei sehr vielen Kategorien uebersichtlich.
 * Hauptkategorien mit bereits gewaehlten Kategorien sind anfangs offen.
 */
export const CategoryPicker: FC<CategoryPickerProps> = ({ groups, selectedIds, onChange }) => {
  const t = useTranslations('categoryPicker');
  const selected = new Set(selectedIds);
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.categories.some((c) => selected.has(c.id))).map((g) => g.id)),
  );

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleCategory = (id: string) =>
    onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const toggleGroup = (group: CategoryGroup, allSelected: boolean) => {
    const ids = group.categories.map((c) => c.id);
    onChange(allSelected ? selectedIds.filter((x) => !ids.includes(x)) : [...new Set([...selectedIds, ...ids])]);
  };

  if (groups.every((g) => g.categories.length === 0)) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('empty')}</p>;
  }

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-700">
      {groups
        .filter((group) => group.categories.length > 0)
        .map((group) => {
          const count = group.categories.filter((c) => selected.has(c.id)).length;
          const allSelected = count === group.categories.length;
          const open = openIds.has(group.id);
          return (
            <div key={group.id}>
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={t('selectAllInGroup', { group: group.name })}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = count > 0 && !allSelected;
                  }}
                  onChange={() => toggleGroup(group, allSelected)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                <button
                  type="button"
                  onClick={() => toggleOpen(group.id)}
                  aria-expanded={open}
                  className="flex flex-1 items-center justify-between gap-2 text-left text-sm font-medium text-zinc-900 dark:text-zinc-50"
                >
                  <span>
                    <span className="mr-1.5 font-mono tabular-nums text-zinc-500 dark:text-zinc-400">{group.number}</span>
                    {group.name}
                  </span>
                  <span className="flex items-center gap-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                    {count}/{group.categories.length}
                    <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>
              </div>
              {open && (
                <div className="space-y-1 px-3 pb-3 pl-9">
                  {group.categories.map((category) => (
                    <label key={category.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={selected.has(category.id)}
                        onChange={() => toggleCategory(category.id)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                      />
                      <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {formatCategoryNumber(group.number, category.number)}
                      </span>
                      {category.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
