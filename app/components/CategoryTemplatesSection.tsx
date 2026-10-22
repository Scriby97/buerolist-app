'use client';

import { useEffect, useState, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from './ConfirmDialog';
import { CategoryPicker } from './CategoryPicker';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import {
  getCategoryTemplates,
  createCategoryTemplate,
  updateCategoryTemplate,
  deleteCategoryTemplate,
  type CategoryGroup,
  type CategoryTemplate,
} from '@/lib/api/categories';

interface CategoryTemplatesSectionProps {
  organizationId: string;
  groups: CategoryGroup[];
  showToast: (message: string, type: 'success' | 'error') => void;
}

/**
 * Kategorievorlagen in den Einstellungen: frei benannte Zusammenstellungen
 * von Kategorien (z.B. "Holzwerkrenovation"), die man einem Projekt in einem
 * Schritt zuweist.
 */
export const CategoryTemplatesSection: FC<CategoryTemplatesSectionProps> = ({ organizationId, groups, showToast }) => {
  const t = useTranslations('categoryTemplates');
  const tCommon = useTranslations('common');
  const getApiErrorMessage = useApiErrorMessage();
  const [templates, setTemplates] = useState<CategoryTemplate[]>([]);
  // null = Dialog zu; id null = neue Vorlage
  const [editing, setEditing] = useState<{ id: string | null; name: string; categoryIds: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CategoryTemplate | null>(null);

  useEffect(() => {
    getCategoryTemplates(organizationId).then(setTemplates).catch(() => setTemplates([]));
  }, [organizationId]);

  const categoryCount = groups.reduce((sum, g) => sum + g.categories.length, 0);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      const saved = editing.id
        ? await updateCategoryTemplate(editing.id, { name: editing.name.trim(), categoryIds: editing.categoryIds })
        : await createCategoryTemplate({ name: editing.name.trim(), categoryIds: editing.categoryIds, organizationId });
      setTemplates((prev) =>
        [...prev.filter((tpl) => tpl.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditing(null);
      showToast(t('saveSuccess'), 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: CategoryTemplate) => {
    try {
      await deleteCategoryTemplate(template.id);
      setTemplates((prev) => prev.filter((tpl) => tpl.id !== template.id));
      showToast(t('deleteSuccess'), 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, t('deleteError')), 'error');
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('title')}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ id: null, name: '', categoryIds: [] })}
          disabled={categoryCount === 0}
          className="shrink-0 px-3 py-1.5 text-sm font-semibold rounded-lg bg-brown-600 hover:bg-brown-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('newButton')}
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t('empty')}</p>
        </div>
      ) : (
        <ul className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-700">
          {templates.map((template) => (
            <li key={template.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm text-zinc-900 dark:text-zinc-50">{template.name}</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  {t('categoryCount', { count: template.categoryIds.length })}
                </span>
              </span>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing({ id: template.id, name: template.name, categoryIds: template.categoryIds })}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  {tCommon('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(template)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {tCommon('delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="template-dialog-title">
          <form onSubmit={handleSave} className="flex max-h-[90dvh] w-full max-w-lg flex-col space-y-4 rounded-lg bg-white dark:bg-zinc-800 p-6 shadow-xl">
            <h3 id="template-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {editing.id ? t('editTitle') : t('newTitle')}
            </h3>
            <div className="space-y-1.5">
              <label htmlFor="templateName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('nameLabel')}
              </label>
              <input
                id="templateName"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder={t('namePlaceholder')}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <CategoryPicker
                groups={groups}
                selectedIds={editing.categoryIds}
                onChange={(categoryIds) => setEditing({ ...editing, categoryIds })}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="submit"
                disabled={saving || !editing.name.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-brown-600 hover:bg-brown-700 text-white font-medium disabled:opacity-50"
              >
                {tCommon('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMessage', { name: confirmDelete.name })}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => {
            void handleDelete(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </section>
  );
};
