'use client';

import { useEffect, useState, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { getCategoryTemplates, type CategoryTemplate } from '@/lib/api/categories';

interface CategoryTemplateSelectProps {
  organizationId: string | null;
  /** Kategorien der gewaehlten Vorlage uebernehmen (ersetzt die Auswahl). */
  onApply: (categoryIds: string[]) => void;
}

/**
 * "Vorlage uebernehmen": setzt die Kategorienauswahl eines Projekts in einem
 * Schritt auf die Kategorien einer Vorlage (z.B. "Holzwerkrenovation") -
 * danach laesst sich die Auswahl wie gewohnt anpassen. Erscheint nur, wenn
 * es Vorlagen gibt.
 */
export const CategoryTemplateSelect: FC<CategoryTemplateSelectProps> = ({ organizationId, onApply }) => {
  const t = useTranslations('categoryTemplates');
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    const controller = new AbortController();
    getCategoryTemplates(organizationId, { signal: controller.signal })
      .then(setTemplates)
      .catch(() => {
        if (!controller.signal.aborted) setTemplates([]);
      });
    return () => controller.abort();
  }, [organizationId]);

  if (templates.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="categoryTemplateSelect" className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
        {t('applyLabel')}
      </label>
      <select
        id="categoryTemplateSelect"
        value=""
        onChange={(e) => {
          const template = templates.find((tpl) => tpl.id === e.target.value);
          if (template) onApply(template.categoryIds);
        }}
        className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
      >
        <option value="">{t('applyPlaceholder')}</option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} ({template.categoryIds.length})
          </option>
        ))}
      </select>
    </div>
  );
};
