'use client';

import { useState, useEffect, type FC } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import CreateProjectModal from './createProject';
import { ProjectTimeReport } from './ProjectTimeReport';
import { CategoryEffortChart } from './CategoryEffortChart';
import { ProjectEntryComments } from './ProjectEntryComments';
import { formatProjectNumber } from '@/lib/format/numbers';
import { colorVars, employeeColors, ENTITY_BORDER_TOP, ENTITY_TINT, projectColor } from '@/lib/colors/entityColors';
import { ColorDot } from './ColorDot';
import { formatChf } from '@/lib/format/money';
import { buildCategoryMatrix, formatHoursMinutes } from '@/lib/timeReport/buildTimeMatrix';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import {
  getProjectDetail,
  updateProject,
  deleteProject,
  type ProjectDetail as ProjectDetailData,
} from '@/lib/api/projects';
import { getCategoryGroups, type CategoryGroup } from '@/lib/api/categories';
import { CategoryPicker } from './CategoryPicker';
import { CategoryTemplateSelect } from './CategoryTemplateSelect';
import { formatCategoryNumber, groupCategories } from '@/lib/categories';
import { NotesSection } from './NotesSection';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { ToastContainer } from './Toast';
import { formatDecimalHours } from '@/lib/format/hours';

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
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [savingCategories, setSavingCategories] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTimeReport, setShowTimeReport] = useState(false);
  const [editingProject, setEditingProject] = useState(false);

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
    getCategoryGroups(selectedOrgId).then(setCategoryGroups).catch(() => setCategoryGroups([]));
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

  const { project, categories, notes, timeSummary, costSummary = [], travelSummary = [] } = detail;
  const travelOf = (creatorId?: string) =>
    travelSummary
      .filter((row) => creatorId === undefined || row.creatorId === creatorId)
      .reduce((sum, row) => sum + row.totalMinutes, 0);
  const decimalHours = (minutes: number) => (minutes ? `${formatDecimalHours(minutes)} h` : '');

  // Zeit-Zusammenfassung als Matrix Kategorie x Mitarbeiter (die API liefert
  // bereits pro Mitarbeiter+Kategorie gruppierte Zeilen), mit Total pro
  // Kategorie, pro Mitarbeiter und gesamt.
  const summaryMatrix = buildCategoryMatrix(timeSummary, t('unknownEmployee'));
  const hasTime = summaryMatrix.rows.length > 0;
  const showTotalColumn = summaryMatrix.employees.length > 1;
  const numCell = 'px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap';
  // Mitarbeiter-Spalten farblich unterscheidbar (nur bei mehreren Personen):
  // Farbbalken ueber dem Namen, Spalte leicht eingefaerbt.
  const colors = employeeColors(summaryMatrix.employees);
  const employeeCol = (employeeId: string, className: string, head = false) =>
    showTotalColumn
      ? {
          style: colorVars(colors.get(employeeId)!),
          className: `${className} ${head ? `border-t-4 ${ENTITY_BORDER_TOP}` : ''} ${ENTITY_TINT}`,
        }
      : { className };
  // Material/Spesen pro Mitarbeiter und gesamt (Rappen).
  const costOf = (type: 'material' | 'expense', creatorId?: string) =>
    costSummary
      .filter((row) => row.type === type && (creatorId === undefined || row.creatorId === creatorId))
      .reduce((sum, row) => sum + row.totalRappen, 0);
  const hasCosts = costSummary.some((row) => row.totalRappen > 0);
  const chf = (rappen: number) => (rappen ? formatChf(rappen) : '');
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
          <h1 className="flex items-center gap-3 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            <ColorDot color={projectColor(project.customer?.number, project.number)} className="h-3.5 w-3.5" />
            {formatProjectNumber(project.customer?.number, project.number) && (
              <span className="mr-2 font-mono font-normal tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatProjectNumber(project.customer?.number, project.number)}
              </span>
            )}
            {project.title}
          </h1>
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
            onClick={() => setEditingProject(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {tCommon('edit')}
          </button>
          <button
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {project.status === 'active' ? t('markCompletedButton') : t('markActiveButton')}
          </button>
          <Link
            href={`/reports?type=project&projectId=${project.id}`}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            {t('reportButton')}
          </Link>
        </div>
      )}

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
                    <th key={employee.id} scope="col" {...employeeCol(employee.id, 'px-1.5 py-1.5 text-right align-bottom font-medium leading-tight', true)}>
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
                      <td key={employee.id} {...employeeCol(employee.id, numCell)}>
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
                    <td key={employee.id} {...employeeCol(employee.id, numCell)}>
                      {formatHoursMinutes(summaryMatrix.minutesByEmployee[employee.id] ?? 0)}
                    </td>
                  ))}
                  {showTotalColumn && <td className={numCell}>{formatHoursMinutes(summaryMatrix.totalMinutes)}</td>}
                </tr>
                {travelOf() > 0 && (
                  <tr className="border-t border-zinc-100 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300">
                    <th scope="row" className={`${stickyCell} px-1.5 py-1.5 text-left font-normal`}>{t('travelRowLabel')}</th>
                    {summaryMatrix.employees.map((employee) => (
                      <td key={employee.id} {...employeeCol(employee.id, numCell)}>{decimalHours(travelOf(employee.id))}</td>
                    ))}
                    {showTotalColumn && (
                      <td className={`${numCell} font-medium text-zinc-900 dark:text-zinc-100`}>{decimalHours(travelOf())}</td>
                    )}
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
        {hasCosts && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{t('costsTitle')}</h3>
            <div className="-mx-1.5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-zinc-500 dark:text-zinc-400">
                    <th scope="col" className={`${stickyCell} px-1.5 py-1.5 text-left align-bottom font-medium`}>CHF</th>
                    {summaryMatrix.employees.map((employee) => (
                      <th key={employee.id} scope="col" {...employeeCol(employee.id, 'px-1.5 py-1.5 text-right align-bottom font-medium leading-tight', true)}>
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
                  {(['material', 'expense'] as const).map((type) => (
                    <tr key={type} className="border-t border-zinc-100 dark:border-zinc-700/60">
                      <th scope="row" className={`${stickyCell} px-1.5 py-1.5 text-left font-normal`}>
                        {type === 'material' ? t('costsMaterial') : t('costsExpenses')}
                      </th>
                      {summaryMatrix.employees.map((employee) => (
                        <td key={employee.id} {...employeeCol(employee.id, numCell)}>{chf(costOf(type, employee.id))}</td>
                      ))}
                      {showTotalColumn && (
                        <td className={`${numCell} font-medium text-zinc-900 dark:text-zinc-100`}>{chf(costOf(type))}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 dark:border-zinc-600 font-semibold text-zinc-900 dark:text-zinc-50">
                    <th scope="row" className={`${stickyCell} px-1.5 py-1.5 text-left`}>{t('totalLabel')}</th>
                    {summaryMatrix.employees.map((employee) => (
                      <td key={employee.id} {...employeeCol(employee.id, numCell)}>
                        {chf(costOf('material', employee.id) + costOf('expense', employee.id))}
                      </td>
                    ))}
                    {showTotalColumn && (
                      <td className={numCell}>{formatChf(costOf('material') + costOf('expense'))}</td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        {summaryMatrix.rows.length >= 2 && (
          <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <CategoryEffortChart
              title={t('categoryChartTitle')}
              rows={summaryMatrix.rows.map((row) => ({
                key: row.categoryId ?? 'none',
                label: row.categoryName ?? t('noCategoryLabel'),
                totalMinutes: row.totalMinutes,
              }))}
            />
          </div>
        )}
      </div>

      {/* Bemerkungen aus den Zeiteintraegen (aufklappbar) */}
      <ProjectEntryComments projectId={project.id} organizationId={project.organizationId} />

      {/* Notizen */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
        <NotesSection
          projectId={project.id}
          notes={notes}
          onChanged={(next) => setDetail((prev) => (prev ? { ...prev, notes: next } : prev))}
        />
      </div>

      {/* Kategorien - weiter unten und zugeklappt: werden meist einmal
          gewaehlt und danach kaum mehr angefasst; es koennen viele sein. */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCategoriesOpen((o) => !o)}
            aria-expanded={categoriesOpen || editingCategories}
            className="flex flex-1 items-center gap-2 text-left"
          >
            <svg className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${categoriesOpen || editingCategories ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t('categoriesTitle')} <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">({categories.length})</span>
            </h2>
          </button>
          {canManageSelectedOrganization && !editingCategories && (
            <button
              onClick={() => {
                setEditingCategories(true);
                setCategoriesOpen(true);
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {tCommon('edit')}
            </button>
          )}
        </div>

        {editingCategories ? (
          <div className="space-y-3">
            <CategoryTemplateSelect organizationId={selectedOrgId} onApply={setSelectedCategoryIds} />
            <CategoryPicker groups={categoryGroups} selectedIds={selectedCategoryIds} onChange={setSelectedCategoryIds} />
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
        ) : categoriesOpen ? (
          categories.length > 0 ? (
            <div className="space-y-3">
              {groupCategories(categories).map(({ group, categories: list }) => (
                <div key={group?.id ?? 'none'}>
                  {group && (
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      <span className="mr-1.5 font-mono tabular-nums text-zinc-500 dark:text-zinc-400">{group.number}</span>
                      {group.name}
                    </p>
                  )}
                  <ul className="mt-1 space-y-0.5 pl-1">
                    {list.map((category) => (
                      <li key={category.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                        <span className="mr-2 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                          {formatCategoryNumber(group?.number, category.number)}
                        </span>
                        {category.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noCategoriesSelected')}</p>
          )
        ) : null}
      </div>

      {/* Loeschen bewusst ganz unten und dezent - wird selten gebraucht. */}
      {canManageSelectedOrganization && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-700 pt-6">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('deleteProjectHint')}</p>
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            {t('deleteProjectButton')}
          </button>
        </div>
      )}

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
      {editingProject && (
        <CreateProjectModal
          customerId={project.customerId}
          project={project}
          onClose={() => setEditingProject(false)}
          onCreated={(updated) => {
            setDetail((prev) => (prev ? { ...prev, project: { ...prev.project, title: updated.title } } : prev));
            setEditingProject(false);
          }}
        />
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
