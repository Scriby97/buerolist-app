'use client';

import { useState, useEffect, type FC } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { getCustomerDetail, deleteCustomer, type CustomerDetail as CustomerDetailData } from '@/lib/api/customers';
import { NotesSection } from './NotesSection';
import { ConfirmDialog } from './ConfirmDialog';
import { useToast } from '@/lib/hooks/useToast';
import { ToastContainer } from './Toast';

interface CustomerDetailProps {
  customerId: string;
  onBack: () => void;
  onSelectProject: (projectId: string) => void;
  onAddProject: () => void;
  onDeleted: () => void;
}

const CustomerDetail: FC<CustomerDetailProps> = ({ customerId, onBack, onSelectProject, onAddProject, onDeleted }) => {
  const t = useTranslations('customerDetail');
  const tCommon = useTranslations('common');
  const dateLocale = useDateLocale();
  const { canManageSelectedOrganization } = useOrganization();
  const getApiErrorMessage = useApiErrorMessage();
  const { toasts, showToast, removeToast } = useToast();

  const [detail, setDetail] = useState<CustomerDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    getCustomerDetail(customerId, { signal: controller.signal })
      .then(setDetail)
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(getApiErrorMessage(err, t('loadError')));
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCustomer(customerId);
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

  const { customer, projects, notes } = detail;
  const activeProjects = projects.filter((p) => p.status === 'active');
  const completedProjects = projects.filter((p) => p.status === 'completed');

  return (
    <section className="space-y-6">
      <button onClick={onBack} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
        {t('backLink')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{customer.name}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            {customer.contactEmail && <span>{customer.contactEmail}</span>}
            {customer.contactPhone && <span>{customer.contactPhone}</span>}
          </div>
          {customer.address && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{customer.address}</p>
          )}
        </div>
        {canManageSelectedOrganization && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
          >
            {tCommon('delete')}
          </button>
        )}
      </div>

      {/* Projekt-History */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('projectsTitle')}</h2>
          {canManageSelectedOrganization && (
            <button
              onClick={onAddProject}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('addProjectButton')}
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noProjects')}</p>
        ) : (
          <div className="space-y-4">
            {activeProjects.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('activeProjectsLabel')}
                </h3>
                {activeProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="w-full text-left rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{project.title}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(project.createdAt).toLocaleDateString(dateLocale)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {completedProjects.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t('completedProjectsLabel')}
                </h3>
                {completedProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    className="w-full text-left rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all flex items-center justify-between gap-2 opacity-75"
                  >
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{project.title}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(project.createdAt).toLocaleDateString(dateLocale)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notizen */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
        <NotesSection
          customerId={customer.id}
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

export default CustomerDetail;
