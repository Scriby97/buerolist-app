'use client';

import { useState, useEffect, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { ProjectTimeReport } from './ProjectTimeReport';
import { buildCategoryMatrix, formatHoursMinutes } from '@/lib/timeReport/buildTimeMatrix';
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
  const [showTimeReport, setShowTimeReport] = useState(false);

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

  // Zeit-Zusammenfassung als Matrix Kategorie x Mitarbeiter (die API liefert
  // bereits pro Mitarbeiter+Kategorie gruppierte Zeilen), mit Total pro
  // Kategorie, pro Mitarbeiter und gesamt.
  const summaryMatrix = buildCategoryMatrix(timeSummary, t('unknownEmployee'));
  const hasTime = summaryMatrix.rows.length > 0;
  const showTotalColumn = summaryMatrix.employees.length > 1;
  const numCell = 'px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap';
  // Kategorie-Spalte bleibt beim seitlichen Scrollen (viele Mitarbeiter) stehen.
  const stickyCell = 'sticky left-0 z-10 bg-white dark:bg-zinc-800';
  // Namen zweizeilig (Vorname / Rest), damit auch auf dem Handy mehrere
  // Mitarbeiter plus Total-Spalte nebeneinander Platz haben.
  const splitName = (name: string) => {
    const space = name.indexOf(' ');
    return space === -1 ? [name] : [name.slice(0, space), name.slice(space + 1)];
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
      {/* Ganze Karte klickbar (oeffnet die Zeitaufstellung), der Button daneben
          ist das fuer Tastatur/Screenreader erreichbare Bedienelement. */}
      <div
        onClick={hasTime ? () => setShowTimeReport(true) : undefined}
        className={`rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-3 ${
          hasTime ? 'cursor-pointer transition-colors hover:border-blue-300 dark:hover:border-blue-700' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('timeSummaryTitle')}</h2>
          {hasTime && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTimeReport(true);
              }}
              className="shrink-0 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('timeSummaryDetails')} →
            </button>
          )}
        </div>
        {!hasTime ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noTimeEntries')}</p>
        ) : (
          <div className="-mx-1.5 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-zinc-500 dark:text-zinc-400">
                  <th scope="col" className={`${stickyCell} px-1.5 py-1.5 text-left align-bottom font-medium`}>{t('categoryColumn')}</th>
                  {summaryMatrix.employees.map((employee) => (
                    <th key={employee.id} scope="col" className="px-1.5 py-1.5 text-right align-bottom font-medium leading-tight">
                      {splitName(employee.name).map((part, idx) => (
                        <span key={idx} className="block whitespace-nowrap">{part}</span>
                      ))}
                    </th>
                  ))}
                  {showTotalColumn && (
                    <th scope="col" className="px-1.5 py-1.5 text-right align-bottom font-semibold text-zinc-700 dark:text-zinc-300">
                      {t('totalLabel')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="text-zinc-700 dark:text-zinc-300">
                {summaryMatrix.rows.map((row) => (
                  <tr key={row.categoryId ?? 'none'} className="border-t border-zinc-100 dark:border-zinc-700/60">
                    <th scope="row" className={`${stickyCell} px-1.5 py-1.5 text-left font-normal`}>
                      {row.categoryName ?? t('noCategoryLabel')}
                    </th>
                    {summaryMatrix.employees.map((employee) => (
                      <td key={employee.id} className={numCell}>
                        {formatHoursMinutes(row.minutesByEmployee[employee.id] ?? 0)}
                      </td>
                    ))}
                    {showTotalColumn && (
                      <td className={`${numCell} font-medium text-zinc-900 dark:text-zinc-100`}>
                        {formatHoursMinutes(row.totalMinutes)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-200 dark:border-zinc-600 font-semibold text-zinc-900 dark:text-zinc-50">
                  <th scope="row" className={`${stickyCell} px-1.5 py-1.5 text-left`}>{t('totalLabel')}</th>
                  {summaryMatrix.employees.map((employee) => (
                    <td key={employee.id} className={numCell}>
                      {formatHoursMinutes(summaryMatrix.minutesByEmployee[employee.id] ?? 0)}
                    </td>
                  ))}
                  {showTotalColumn && <td className={numCell}>{formatHoursMinutes(summaryMatrix.totalMinutes)}</td>}
                </tr>
              </tfoot>
            </table>
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
      {showTimeReport && (
        <ProjectTimeReport
          projectId={project.id}
          organizationId={project.organizationId}
          projectTitle={project.title}
          customerName={project.customer?.name}
          onClose={() => setShowTimeReport(false)}
        />
      )}
    </section>
  );
};

export default ProjectDetail;
