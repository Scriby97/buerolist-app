'use client';

import { useState, useEffect, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import {
  getProjectDetail,
  updateProject,
  deleteProject,
  type ProjectDetail as ProjectDetailData,
} from '@/lib/api/projects';
import { getCategories, type Category } from '@/lib/api/categories';
import { NotesSection } from './NotesSection';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { ToastContainer } from './Toast';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onDeleted: () => void;
}

const ProjectDetail: FC<ProjectDetailProps> = ({ projectId, onBack, onDeleted }) => {
  const t = useTranslations('projectDetail');
  const tCommon = useTranslations('common');
  const { canManageSelectedOrganization, selectedOrgId } = useOrganization();
  const getApiErrorMessage = useApiErrorMessage();
  const { toasts, showToast, removeToast } = useToast();

  const [detail, setDetail] = useState<ProjectDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [editingCategories, setEditingCategories] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    getProjectDetail(projectId, { signal: controller.signal })
      .then((data) => {
        setDetail(data);
        setSelectedCategoryIds(data.categories.map((c) => c.id));
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(getApiErrorMessage(err, t('loadError')));
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!editingCategories || !selectedOrgId) return;
    getCategories(selectedOrgId).then(setAllCategories).catch(() => setAllCategories([]));
  }, [editingCategories, selectedOrgId]);

  const handleSaveCategories = async () => {
    setSavingCategories(true);
    try {
      await updateProject(projectId, { categoryIds: selectedCategoryIds });
      const refreshed = await getProjectDetail(projectId);
      setDetail(refreshed);
      setEditingCategories(false);
      showToast(t('categoriesSaved'), 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error');
    } finally {
      setSavingCategories(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!detail) return;
    setTogglingStatus(true);
    try {
      const nextStatus = detail.project.status === 'active' ? 'completed' : 'active';
      const updated = await updateProject(projectId, { status: nextStatus });
      setDetail((prev) => (prev ? { ...prev, project: updated } : prev));
      showToast(t('statusUpdated'), 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, t('saveError')), 'error');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(projectId);
      onDeleted();
    } catch (err) {
      showToast(getApiErrorMessage(err, t('deleteError')), 'error');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-4 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">{tCommon('loading')}</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          {t('backLink')}
        </button>
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{error ?? t('loadError')}</p>
        </div>
      </div>
    );
  }

  const { project, categories, notes, timeSummary } = detail;

  // Zeit-Zusammenfassung pro Mitarbeiter aggregieren (die API liefert bereits
  // pro Mitarbeiter+Kategorie gruppierte Zeilen - hier zu einer Gesamtzeit pro
  // Mitarbeiter zusammengefasst, die Kategorie-Aufschluesselung bleibt darunter).
  const byCreator = new Map<string, { name: string; totalMinutes: number; rows: typeof timeSummary }>();
  timeSummary.forEach((row) => {
    const name = row.creatorFirstName || row.creatorLastName
      ? `${row.creatorFirstName ?? ''} ${row.creatorLastName ?? ''}`.trim()
      : row.creatorEmail ?? t('unknownEmployee');
    const existing = byCreator.get(row.creatorId);
    if (existing) {
      existing.totalMinutes += row.totalMinutes;
      existing.rows.push(row);
    } else {
      byCreator.set(row.creatorId, { name, totalMinutes: row.totalMinutes, rows: [row] });
    }
  });

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  };

  return (
    <section className="space-y-6">
      <button onClick={onBack} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        {t('backLink')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{project.title}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {project.customer?.name}
          </p>
        </div>
        <span className={[
          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold',
          project.status === 'active'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
        ].join(' ')}>
          {project.status === 'active' ? t('statusActive') : t('statusCompleted')}
        </span>
      </div>

      {canManageSelectedOrganization && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {project.status === 'active' ? t('markCompletedButton') : t('markActiveButton')}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            {tCommon('delete')}
          </button>
        </div>
      )}

      {/* Kategorien */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('categoriesTitle')}</h2>
          {canManageSelectedOrganization && !editingCategories && (
            <button
              onClick={() => setEditingCategories(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {tCommon('edit')}
            </button>
          )}
        </div>

        {editingCategories ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {allCategories.map((category) => {
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
              {allCategories.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noCategoriesInOrg')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveCategories}
                disabled={savingCategories}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-brown-600 hover:bg-brown-700 text-white disabled:opacity-50 transition-colors"
              >
                {savingCategories ? t('saving') : tCommon('save')}
              </button>
              <button
                onClick={() => {
                  setEditingCategories(false);
                  setSelectedCategoryIds(categories.map((c) => c.id));
                }}
                className="px-4 py-1.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                {tCommon('cancel')}
              </button>
            </div>
          </div>
        ) : categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category.id}
                className="px-3 py-1 rounded-full text-sm bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              >
                {category.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noCategoriesSelected')}</p>
        )}
      </div>

      {/* Zeit-Zusammenfassung */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('timeSummaryTitle')}</h2>
        {byCreator.size === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noTimeEntries')}</p>
        ) : (
          <div className="space-y-4">
            {Array.from(byCreator.entries()).map(([creatorId, data]) => (
              <div key={creatorId}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{data.name}</span>
                  <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    {formatMinutes(data.totalMinutes)}
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {data.rows.map((row, idx) => (
                    <li key={idx} className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400 pl-3">
                      <span>{row.categoryName ?? t('noCategoryLabel')}</span>
                      <span>{formatMinutes(row.totalMinutes)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notizen */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
        <NotesSection
          projectId={project.id}
          notes={notes}
          onChanged={(next) => setDetail((prev) => (prev ? { ...prev, notes: next } : prev))}
        />
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {confirmDelete && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMessage')}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {deleting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </section>
  );
};

export default ProjectDetail;
