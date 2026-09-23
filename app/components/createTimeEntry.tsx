'use client';

import { useState, useCallback, useEffect, useRef, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { getApiBaseUrlOrNull } from '@/lib/api/url';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useToast } from '@/lib/hooks/useToast';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { getProjects, getProjectDetail, type Project } from '@/lib/api/projects';
import { createTimeEntry } from '@/lib/api/timeEntries';
import type { Category } from '@/lib/api/categories';
import { ToastContainer } from './Toast';

interface FormState {
  projectId: string;
  categoryId: string;
  date: string;
  startTime: string;
  endTime: string;
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Zwischenspeicherung der Formular-Eingaben, damit ein Mitarbeiter offline
// erfasste Werte nicht verliert, wenn er die App schliesst und erst spaeter
// (mit Empfang) zur Erfassung zurueckkehrt - siehe FleetTracks createUsage.tsx.
// Pro Organisation getrennt, damit Mitarbeiter mit mehreren Organisationen
// keinen falsch zugeordneten Entwurf vorfinden.
function getDraftStorageKey(organizationId: string): string {
  return `buerolist:createTimeEntryDraft:${organizationId}`;
}

function loadDraft(organizationId: string): Partial<FormState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(organizationId));
    return raw ? (JSON.parse(raw) as Partial<FormState>) : null;
  } catch {
    return null;
  }
}

function isLikelyOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) return true;
  return false;
}

interface CreateTimeEntryProps {
  onNavigateToAddProject?: () => void;
}

const CreateTimeEntry: FC<CreateTimeEntryProps> = ({ onNavigateToAddProject }) => {
  const { isAdmin } = useAuth();
  const { organizations, selectedOrgId, setSelectedOrgId, canManageSelectedOrganization } = useOrganization();
  const { toasts, showToast, removeToast } = useToast();
  const t = useTranslations('createTimeEntry');
  const tCommon = useTranslations('common');
  const getApiErrorMessage = useApiErrorMessage();

  const [formData, setFormData] = useState<FormState>({
    projectId: '',
    categoryId: '',
    date: getTodayDate(),
    startTime: '',
    endTime: '',
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const currentProjectIdRef = useRef<string>('');
  const [activeDraftOrgId, setActiveDraftOrgId] = useState<string | null>(null);
  const [dismissedNoProjectsDialog, setDismissedNoProjectsDialog] = useState(false);
  const showNoProjectsDialog =
    !projectsLoading && !projectsError && projects.length === 0 && !!selectedOrgId && !dismissedNoProjectsDialog;

  // Entwurf laden, sobald (und jedes Mal wenn) die ausgewaehlte Organisation
  // bekannt ist bzw. wechselt.
  useEffect(() => {
    if (!selectedOrgId) return;

    setDismissedNoProjectsDialog(false);

    const draft = loadDraft(selectedOrgId);
    currentProjectIdRef.current = draft?.projectId ?? '';

    setFormData({
      projectId: draft?.projectId ?? '',
      categoryId: draft?.categoryId ?? '',
      date: draft?.date ?? getTodayDate(),
      startTime: draft?.startTime ?? '',
      endTime: draft?.endTime ?? '',
    });
    setActiveDraftOrgId(selectedOrgId);
  }, [selectedOrgId]);

  // Formular-Eingaben laufend zwischenspeichern - siehe FleetTracks createUsage.tsx.
  useEffect(() => {
    if (!selectedOrgId || activeDraftOrgId !== selectedOrgId) return;
    try {
      window.localStorage.setItem(getDraftStorageKey(selectedOrgId), JSON.stringify(formData));
    } catch {
      // localStorage nicht verfuegbar (z.B. Private Mode) - Entwurf wird dann nicht zwischengespeichert
    }
  }, [formData, selectedOrgId, activeDraftOrgId]);

  const fetchProjectCategories = useCallback(async (projectId: string) => {
    if (!projectId) {
      setCategories([]);
      return;
    }
    setCategoriesLoading(true);
    try {
      const detail = await getProjectDetail(projectId);
      setCategories(detail.categories);
    } catch {
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const handleProjectChange = useCallback((projectId: string) => {
    currentProjectIdRef.current = projectId;
    setFormData((prev) => ({ ...prev, projectId, categoryId: '' }));
    fetchProjectCategories(projectId);
  }, [fetchProjectCategories]);

  const validateTimes = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) {
      setTimeError(null);
      return;
    }
    if (endTime <= startTime) {
      setTimeError(t('endTimeValidation'));
    } else {
      setTimeError(null);
    }
  };

  const handleSaveSuccess = (projectId: string, categoryId: string) => {
    // Zuletzt gewaehltes Projekt/Kategorie bleiben fuer die naechste
    // Erfassung voreingestellt - nur die Uhrzeiten werden zurueckgesetzt.
    setFormData({ projectId, categoryId, date: getTodayDate(), startTime: '', endTime: '' });
    showToast(t('saveSuccess'), 'success');
  };

  const handleSaveError = (err: unknown) => {
    console.error('Fehler beim Speichern des Zeiteintrags:', err);
    if (isLikelyOfflineError(err)) {
      const message = t('offlineErrorMessage');
      setError(message);
      showToast(message, 'error');
    } else {
      setError(getApiErrorMessage(err, t('saveErrorGeneric')));
      showToast(t('saveErrorToast'), 'error');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!formData.projectId) throw new Error(t('selectProjectError'));
      if (!formData.startTime || !formData.endTime) throw new Error(t('timesRequiredError'));
      if (formData.endTime <= formData.startTime) throw new Error(t('endTimeMustBeAfterError'));

      const startAt = new Date(`${formData.date}T${formData.startTime}:00`).toISOString();
      const endAt = new Date(`${formData.date}T${formData.endTime}:00`).toISOString();

      await createTimeEntry({
        projectId: formData.projectId,
        categoryId: formData.categoryId || undefined,
        startAt,
        endAt,
      });
      handleSaveSuccess(formData.projectId, formData.categoryId);
    } catch (err) {
      handleSaveError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Projekte laden, sobald eine Organisation ausgewaehlt ist.
  useEffect(() => {
    const apiBaseUrl = getApiBaseUrlOrNull();
    if (!apiBaseUrl || !selectedOrgId) return;

    const controller = new AbortController();
    const fetchProjects = async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const data = await getProjects(selectedOrgId, { signal: controller.signal });
        setProjects(data);
        const currentValid = data.find((p) => p.id === currentProjectIdRef.current);
        const selectedProjectId = currentValid ? currentProjectIdRef.current : data[0]?.id ?? '';
        setFormData((prev) => ({ ...prev, projectId: selectedProjectId }));
        currentProjectIdRef.current = selectedProjectId;
        if (selectedProjectId) {
          fetchProjectCategories(selectedProjectId);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Fehler beim Laden der Projekte:', err);
        setProjectsError(t('projectsLoadError'));
      } finally {
        setProjectsLoading(false);
      }
    };

    fetchProjects();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {t('title')}
        </h1>
        {isAdmin && organizations.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <label htmlFor="createTimeEntryOrgSelect" className="text-sm text-zinc-600 dark:text-zinc-400">
              {tCommon('organizationLabel')}:
            </label>
            <select
              id="createTimeEntryOrgSelect"
              value={selectedOrgId || ''}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="px-3 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            >
              {organizations.map(org => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
            <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
          </div>
        )}

        {/* Projekt */}
        <div className="space-y-2">
          <label htmlFor="project" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('projectLabel')}
          </label>
          <select
            id="project"
            value={formData.projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
          >
            {projectsLoading ? (
              <option value="" disabled>{t('loadingProjects')}</option>
            ) : projectsError ? (
              <option value="" disabled>{projectsError}</option>
            ) : projects.length === 0 ? (
              <option value="" disabled>{t('noProjectsAvailable')}</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.customer?.name ? `${project.customer.name} - ${project.title}` : project.title}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Kategorie (nur, wenn das Projekt welche hat) */}
        {(categoriesLoading || categories.length > 0) && (
          <div className="space-y-2">
            <label htmlFor="category" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('categoryLabel')}
            </label>
            <select
              id="category"
              value={formData.categoryId}
              onChange={(e) => setFormData((prev) => ({ ...prev, categoryId: e.target.value }))}
              className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
              disabled={categoriesLoading}
            >
              <option value="">{t('noCategoryOption')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Datum */}
        <div className="space-y-2">
          <label htmlFor="entryDate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('dateLabel')}
          </label>
          <input
            id="entryDate"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        {/* Von / Bis */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="startTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('startTimeLabel')}
            </label>
            <input
              id="startTime"
              type="time"
              value={formData.startTime}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, startTime: e.target.value }));
                validateTimes(e.target.value, formData.endTime);
              }}
              className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="endTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('endTimeLabel')}
            </label>
            <input
              id="endTime"
              type="time"
              value={formData.endTime}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, endTime: e.target.value }));
                validateTimes(formData.startTime, e.target.value);
              }}
              className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        {timeError && (
          <p className="text-sm text-red-700 dark:text-red-200">{timeError}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !!timeError}
          className="w-full rounded-lg bg-brown-600 hover:bg-brown-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 font-medium text-white transition-colors"
        >
          {isSubmitting ? t('submitting') : t('submitButton')}
        </button>
      </form>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {showNoProjectsDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-projects-dialog-title"
        >
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 id="no-projects-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {t('noProjectsDialogTitle')}
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {canManageSelectedOrganization ? t('noProjectsDialogAdminMessage') : t('noProjectsDialogEmployeeMessage')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDismissedNoProjectsDialog(true)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                {tCommon('close')}
              </button>
              {canManageSelectedOrganization && onNavigateToAddProject && (
                <button
                  onClick={() => {
                    setDismissedNoProjectsDialog(true);
                    onNavigateToAddProject();
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-brown-600 hover:bg-brown-700 text-white font-medium transition-colors"
                >
                  {t('noProjectsDialogAddProjectButton')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CreateTimeEntry;
