'use client';

import { useState, useEffect, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { createProject, type Project } from '@/lib/api/projects';
import { getCategories, type Category } from '@/lib/api/categories';

interface CreateProjectModalProps {
  customerId: string;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

const CreateProjectModal: FC<CreateProjectModalProps> = ({ customerId, onClose, onCreated }) => {
  const t = useTranslations('createProject');
  const tCommon = useTranslations('common');
  const { selectedOrgId } = useOrganization();
  const getApiErrorMessage = useApiErrorMessage();

  const [title, setTitle] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgId) return;
    getCategories(selectedOrgId).then(setCategories).catch(() => setCategories([]));
  }, [selectedOrgId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !selectedOrgId) return;
    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject({
        title: title.trim(),
        customerId,
        categoryIds: selectedCategoryIds,
        organizationId: selectedOrgId,
      });
      onCreated(project);
    } catch (err) {
      setError(getApiErrorMessage(err, t('createError')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('title')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="projectTitle" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('titleLabel')}
            </label>
            <input
              id="projectTitle"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500"
              placeholder={t('titlePlaceholder')}
            />
          </div>

          {categories.length > 0 && (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {t('categoriesLabel')}
              </span>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const checked = selectedCategoryIds.includes(category.id);
                  return (
                    <label
                      key={category.id}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm cursor-pointer border transition-colors',
                        checked
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                          : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() =>
                          setSelectedCategoryIds((prev) =>
                            checked ? prev.filter((id) => id !== category.id) : [...prev, category.id],
                          )
                        }
                      />
                      {category.name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              {tCommon('cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-brown-600 hover:bg-brown-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('submitting') : t('submitButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
