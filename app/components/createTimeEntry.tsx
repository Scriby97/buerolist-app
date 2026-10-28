'use client';

import { useState, useCallback, useEffect, useRef, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { getApiBaseUrlOrNull } from '@/lib/api/url';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useToast } from '@/lib/hooks/useToast';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { getProjects, getProjectDetail, type Project } from '@/lib/api/projects';
import { createTimeEntry, getTimeEntries } from '@/lib/api/timeEntries';
import type { Category } from '@/lib/api/categories';
import { ToastContainer } from './Toast';
import { DateInput } from './DateInput';
import { TimeInput } from './TimeInput';
import { ProjectCombobox } from './ProjectCombobox';
import { CategoryOptions } from './CategoryOptions';
import { EntryItemsEditor } from './EntryItemsEditor';
import { rowsToItems, withTrailingEmptyRow, type ItemRow } from '@/lib/timeEntryItems';
import { currentWeekStartKey } from '@/lib/time/workWeek';
import { NotificationPermissionPrompt } from './NotificationPermissionPrompt';
import { getOrganizationMembers } from '@/lib/api/organizationMembers';
import type { OrganizationMemberDetail } from '@/lib/types/user';
import { personName } from '@/lib/format/personName';
import { parseDecimalHours } from '@/lib/format/hours';
import { scheduleOf, suggestStartTime } from '@/lib/workSchedule';
import { getItemPresets, type ItemPreset } from '@/lib/api/itemPresets';

interface FormState {
  projectId: string;
  categoryId: string;
  date: string;
  startTime: string;
  endTime: string;
  comment: string;
  /** Fahrzeit als Dezimalstunden-Text, z.B. "1.25" */
  travel: string;
  materials: ItemRow[];
  expenses: ItemRow[];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

// Lokales Datum (YYYY-MM-DD) - nicht toISOString(), das waere UTC und
// lieferte z.B. zwischen 00:00 und 02:00 Schweizer Zeit noch den Vortag.
function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// ISO-Zeitpunkt -> lokale Uhrzeit "HH:MM" (Format von <input type="time">).
function toLocalTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
  const { isAdmin, userProfile } = useAuth();
  const { organizations, selectedOrgId, setSelectedOrgId, canManageSelectedOrganization } = useOrganization();
  const { toasts, showToast, removeToast } = useToast();
  const t = useTranslations('createTimeEntry');
  const tItems = useTranslations('entryItems');
  const tCommon = useTranslations('common');
  const getApiErrorMessage = useApiErrorMessage();

  const [formData, setFormData] = useState<FormState>({
    projectId: '',
    categoryId: '',
    date: getTodayDate(),
    startTime: '',
    endTime: '',
    comment: '',
    travel: '',
    materials: withTrailingEmptyRow([]),
    expenses: withTrailingEmptyRow([]),
  });
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  // Admin/Owner: fuer wen erfasst wird ('' = fuer sich selbst)
  const [members, setMembers] = useState<OrganizationMemberDetail[]>([]);
  const [presets, setPresets] = useState<ItemPreset[]>([]);
  const [creatorId, setCreatorId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const currentProjectIdRef = useRef<string>('');
  // Zuletzt automatisch vorgeschlagene Startzeit - nur diese (oder eine leere)
  // wird bei einem Datumswechsel ersetzt, nie eine von Hand eingegebene.
  const autoStartTimeRef = useRef<string>('');
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
    // Zeiten nur aus einem Entwurf von heute uebernehmen - sonst stuende z.B.
    // die Endzeit von gestern als Startzeit drin, statt des Arbeitsbeginns.
    const today = getTodayDate();
    const draftIsToday = draft?.date === today;

    setFormData({
      projectId: draft?.projectId ?? '',
      categoryId: draft?.categoryId ?? '',
      // Beim Oeffnen immer der heutige Tag - ein Entwurf behaelt nur Projekt
      // und Inhalte, nicht das Datum.
      date: today,
      startTime: draftIsToday ? (draft?.startTime ?? '') : '',
      endTime: draftIsToday ? (draft?.endTime ?? '') : '',
      comment: draft?.comment ?? '',
      travel: draft?.travel ?? '',
      materials: withTrailingEmptyRow(draft?.materials ?? []),
      expenses: withTrailingEmptyRow(draft?.expenses ?? []),
    });
    setActiveDraftOrgId(selectedOrgId);
  }, [selectedOrgId, canManageSelectedOrganization]);

  // Formular-Eingaben laufend zwischenspeichern - siehe FleetTracks createUsage.tsx.
  useEffect(() => {
    if (!selectedOrgId || activeDraftOrgId !== selectedOrgId) return;
    try {
      window.localStorage.setItem(getDraftStorageKey(selectedOrgId), JSON.stringify(formData));
    } catch {
      // localStorage nicht verfuegbar (z.B. Private Mode) - Entwurf wird dann nicht zwischengespeichert
    }
  }, [formData, selectedOrgId, activeDraftOrgId]);

  // Ende des letzten eigenen Eintrags am gewaehlten Tag (projektunabhaengig)
  // als Startzeit vorschlagen, damit Eintraege lueckenlos aneinander
  // anschliessen. Admin/Owner bekommen alle Eintraege der Organisation -
  // daher clientseitig auf die eigenen filtern.
  const userId = creatorId || userProfile?.id;
  // Arbeitszeiten der Person, fuer die erfasst wird (Admin: gewaehlter Mitarbeiter)
  const schedule = scheduleOf(creatorId ? members.find((m) => m.userId === creatorId)?.user : userProfile);
  const { workMorningStart, workMorningEnd, workAfternoonStart } = schedule;
  useEffect(() => {
    if (!selectedOrgId || !userId || activeDraftOrgId !== selectedOrgId || !formData.date) return;
    const date = formData.date;
    const controller = new AbortController();

    getTimeEntries(selectedOrgId, {
      startDate: new Date(`${date}T00:00:00`).toISOString(),
      endDate: new Date(`${date}T23:59:59.999`).toISOString(),
      signal: controller.signal,
    })
      .then(({ timeEntries }) => {
        const ownEndTimes = timeEntries
          .filter((entry) => entry.creatorId === userId)
          .map((entry) => entry.endAt)
          .sort();
        const latestEndAt = ownEndTimes[ownEndTimes.length - 1];
        const suggestion = suggestStartTime(latestEndAt ? toLocalTime(latestEndAt) : '', schedule);
        setFormData((prev) => {
          if (prev.date !== date) return prev;
          if (prev.startTime !== '' && prev.startTime !== autoStartTimeRef.current) return prev;
          autoStartTimeRef.current = suggestion;
          return prev.startTime === suggestion ? prev : { ...prev, startTime: suggestion };
        });
      })
      .catch(() => {
        // Offline/abgebrochen - dann eben keine Vorbelegung.
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- schedule ist ueber die drei Zeiten abgedeckt
  }, [formData.date, selectedOrgId, userId, activeDraftOrgId, workMorningStart, workMorningEnd, workAfternoonStart]);

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

  const handleSaveSuccess = (projectId: string, categoryId: string, savedDate: string, savedEndTime: string) => {
    // Zuletzt gewaehltes Projekt/Kategorie bleiben fuer die naechste
    // Erfassung voreingestellt. Die neue Startzeit ist das Ende des eben
    // gespeicherten Eintrags (falls fuer heute erfasst; sonst laedt der
    // Effekt oben den Vorschlag fuer heute).
    const today = getTodayDate();
    const startTime = savedDate === today ? suggestStartTime(savedEndTime, schedule) : '';
    autoStartTimeRef.current = startTime;
    setFormData({
      projectId,
      categoryId,
      date: today,
      startTime,
      endTime: '',
      comment: '',
      travel: '',
      materials: withTrailingEmptyRow([]),
      expenses: withTrailingEmptyRow([]),
    });
    showToast(t('saveSuccess'), 'success');
    // Erst nach dem ersten gespeicherten Eintrag nach der Erlaubnis fuer die
    // Erfassungserinnerung fragen (die Komponente fragt pro User nur einmal).
    setShowNotificationPrompt(true);
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
      const materials = rowsToItems(formData.materials, 'material');
      const expenses = rowsToItems(formData.expenses, 'expense');
      if (!materials || !expenses) throw new Error(tItems('invalid'));
      const travelMinutes = parseDecimalHours(formData.travel);
      if (travelMinutes === undefined) throw new Error(t('travelInvalid'));

      await createTimeEntry({
        projectId: formData.projectId,
        creatorId: creatorId && creatorId !== userProfile?.id ? creatorId : undefined,
        categoryId: formData.categoryId || undefined,
        startAt,
        endAt,
        comment: formData.comment.trim() || undefined,
        travelMinutes: travelMinutes ?? undefined,
        items: [...materials, ...expenses],
      });
      handleSaveSuccess(formData.projectId, formData.categoryId, formData.date, formData.endTime);
    } catch (err) {
      handleSaveError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vordefinierte Material-/Spesen-Positionen der Organisation
  useEffect(() => {
    if (!selectedOrgId) return;
    let cancelled = false;
    getItemPresets(selectedOrgId)
      .then((list) => {
        if (!cancelled) setPresets(list);
      })
      .catch(() => {
        if (!cancelled) setPresets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId]);

  // Admin/Owner: Mitglieder fuer die Mitarbeiterauswahl laden (inkl. ohne Login)
  useEffect(() => {
    setCreatorId('');
    if (!selectedOrgId || !canManageSelectedOrganization) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    getOrganizationMembers(selectedOrgId)
      .then((list) => {
        if (!cancelled) setMembers(list);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrgId, canManageSelectedOrganization]);

  const otherMembers = members
    .filter((m) => m.userId !== userProfile?.id)
    .sort((a, b) => personName(a.user, '?').localeCompare(personName(b.user, '?')));

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

        {/* Mitarbeiter (nur Admin/Owner, wenn es weitere Mitglieder gibt) */}
        {canManageSelectedOrganization && otherMembers.length > 0 && (
          <div className="space-y-2">
            <label htmlFor="entryEmployee" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('employeeLabel')}
            </label>
            <select
              id="entryEmployee"
              value={creatorId}
              onChange={(e) => {
                autoStartTimeRef.current = '';
                setCreatorId(e.target.value);
                setFormData((prev) => ({ ...prev, startTime: '' }));
              }}
              className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{t('employeeSelf', { name: personName(userProfile, '') })}</option>
              {otherMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {personName(m.user, '?')}
                  {m.user.isPlaceholder ? ` (${t('withoutLogin')})` : ''}
                </option>
              ))}
            </select>
            {creatorId && <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('employeeHint')}</p>}
          </div>
        )}

        {/* Projekt */}
        <div className="space-y-2">
          <label htmlFor="project" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('projectLabel')}
          </label>
          {projectsLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('loadingProjects')}</p>
          ) : projectsError ? (
            <p className="text-sm text-red-700 dark:text-red-300">{projectsError}</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noProjectsAvailable')}</p>
          ) : (
            <ProjectCombobox
              id="project"
              value={formData.projectId}
              onChange={handleProjectChange}
              placeholder={t('projectSearchPlaceholder')}
              noMatchesText={t('projectSearchNoMatches')}
              options={projects.map((project) => ({
                id: project.id,
                title: project.title,
                number: project.number,
                customerName: project.customer?.name,
                customerNumber: project.customer?.number,
              }))}
            />
          )}
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
              <CategoryOptions categories={categories} />
            </select>
          </div>
        )}

        {/* Datum */}
        <div className="space-y-2">
          <label htmlFor="entryDate" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('dateLabel')}
          </label>
          <DateInput
            id="entryDate"
            value={formData.date}
            onChange={(date) => setFormData((prev) => ({ ...prev, date }))}
            required
            min={canManageSelectedOrganization ? undefined : currentWeekStartKey()}
          />
        </div>

        {/* Von / Bis */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="startTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('startTimeLabel')}
            </label>
            <TimeInput
              id="startTime"
              value={formData.startTime}
              onChange={(startTime) => {
                setFormData((prev) => ({ ...prev, startTime }));
                validateTimes(startTime, formData.endTime);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="endTime" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('endTimeLabel')}
            </label>
            <TimeInput
              id="endTime"
              value={formData.endTime}
              onChange={(endTime) => {
                setFormData((prev) => ({ ...prev, endTime }));
                validateTimes(formData.startTime, endTime);
              }}
              required
            />
          </div>
        </div>
        {timeError && (
          <p className="text-sm text-red-700 dark:text-red-200">{timeError}</p>
        )}

        {/* Fahrzeit (Dezimalstunden, separat von der Arbeitszeit) */}
        <div className="space-y-2">
          <label htmlFor="entryTravel" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('travelLabel')}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="entryTravel"
              type="text"
              inputMode="decimal"
              value={formData.travel}
              onChange={(e) => setFormData((prev) => ({ ...prev, travel: e.target.value }))}
              placeholder="0.00"
              aria-invalid={parseDecimalHours(formData.travel) === undefined}
              className="w-28 px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">h</span>
          </div>
          {parseDecimalHours(formData.travel) === undefined && (
            <p className="text-sm text-red-700 dark:text-red-200">{t('travelInvalid')}</p>
          )}
        </div>

        {/* Material und Spesen (beliebig viele Positionen) */}
        <EntryItemsEditor
          idPrefix="material"
          title={tItems('materialTitle')}
          rows={formData.materials}
          onChange={(materials) => setFormData((prev) => ({ ...prev, materials }))}
          presets={presets.filter((p) => p.type === 'material')}
        />
        <EntryItemsEditor
          idPrefix="expense"
          title={tItems('expensesTitle')}
          rows={formData.expenses}
          onChange={(expenses) => setFormData((prev) => ({ ...prev, expenses }))}
          presets={presets.filter((p) => p.type === 'expense')}
        />

        {/* Bemerkung (optional) */}
        <div className="space-y-2">
          <label htmlFor="entryComment" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t('commentLabel')}
          </label>
          <textarea
            id="entryComment"
            rows={2}
            maxLength={1000}
            value={formData.comment}
            onChange={(e) => setFormData((prev) => ({ ...prev, comment: e.target.value }))}
            className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-4 py-2 text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !!timeError}
          className="w-full rounded-lg bg-brown-600 hover:bg-brown-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 font-medium text-white transition-colors"
        >
          {isSubmitting ? t('submitting') : t('submitButton')}
        </button>
      </form>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {showNotificationPrompt && <NotificationPermissionPrompt />}

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
