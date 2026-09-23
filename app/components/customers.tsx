'use client';

import { useState, useEffect, type FC } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getApiBaseUrlOrNull } from '@/lib/api/url';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { getCustomers, type Customer } from '@/lib/api/customers';
import CustomerDetail from './CustomerDetail';
import ProjectDetail from './ProjectDetail';
import CreateCustomerModal from './createCustomer';
import CreateProjectModal from './createProject';

interface CustomerItemProps {
  customer: Customer;
  onSelect: (id: string) => void;
}

const CustomerItem: FC<CustomerItemProps> = ({ customer, onSelect }) => (
  <button
    onClick={() => onSelect(customer.id)}
    className="w-full text-left rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all flex items-center gap-3"
  >
    <span className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3" />
        <path d="M21 20c0-2.8-1.9-5.1-4.5-5.8" />
      </svg>
    </span>
    <div className="min-w-0 flex-1">
      <h3 className="font-semibold text-zinc-900 dark:text-zinc-50 truncate">{customer.name}</h3>
      {(customer.contactEmail || customer.contactPhone) && (
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
          {customer.contactEmail && <span>{customer.contactEmail}</span>}
          {customer.contactPhone && <span>{customer.contactPhone}</span>}
        </div>
      )}
    </div>
    <svg className="w-5 h-5 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  </button>
);

const Customers: FC = () => {
  const { isAdmin } = useAuth();
  const { organizations, selectedOrgId, setSelectedOrgId, canManageSelectedOrganization } = useOrganization();
  const t = useTranslations('customersOverview');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [addingProjectForCustomerId, setAddingProjectForCustomerId] = useState<string | null>(null);

  // Detail-Navigation ueber URL-Parameter (nicht lokalen State) - gleiches
  // Muster wie FleetTracks vehicles.tsx: jeder Kunden-/Projekt-Aufruf legt
  // einen Browser-Verlauf-Eintrag an, "Zurueck" funktioniert dadurch korrekt.
  const selectedCustomerId = searchParams.get('customerId');
  const selectedProjectId = searchParams.get('projectId');
  const selectCustomer = (id: string) => router.push(`${pathname}?customerId=${id}`);
  const selectProject = (id: string) => router.push(`${pathname}?customerId=${selectedCustomerId}&projectId=${id}`);
  const backToCustomer = () => router.back();
  const backToList = () => router.push(pathname);

  useEffect(() => {
    const apiBaseUrl = getApiBaseUrlOrNull();
    if (!apiBaseUrl || !selectedOrgId) return;

    const controller = new AbortController();
    const fetchCustomers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getCustomers(selectedOrgId, { signal: controller.signal });
        setCustomers([...data].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Fehler beim Laden der Kunden:', err);
        setError(t('loadError'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
    return () => controller.abort();
  }, [selectedOrgId, reloadKey, t]);

  if (selectedProjectId) {
    return (
      <ProjectDetail
        projectId={selectedProjectId}
        onBack={backToCustomer}
        onDeleted={() => {
          setReloadKey((k) => k + 1);
          backToCustomer();
        }}
      />
    );
  }

  if (selectedCustomerId) {
    return (
      <>
        <CustomerDetail
          customerId={selectedCustomerId}
          onBack={backToList}
          onSelectProject={selectProject}
          onAddProject={() => setAddingProjectForCustomerId(selectedCustomerId)}
          onDeleted={() => {
            setReloadKey((k) => k + 1);
            backToList();
          }}
        />
        {addingProjectForCustomerId && (
          <CreateProjectModal
            customerId={addingProjectForCustomerId}
            onClose={() => setAddingProjectForCustomerId(null)}
            onCreated={(project) => {
              setAddingProjectForCustomerId(null);
              selectProject(project.id);
            }}
          />
        )}
      </>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {t('title')}
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
            {isAdmin && organizations.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="customersOrgSelect" className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                  {tCommon('organizationLabel')}:
                </label>
                <select
                  id="customersOrgSelect"
                  value={selectedOrgId || ''}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('customersFoundCount', { count: customers.length })}
            </p>
          </div>
        </div>
        {canManageSelectedOrganization && (
          <button
            onClick={() => setShowCreateCustomer(true)}
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 hover:bg-brown-700 text-white transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t('addCustomerButton')}
          </button>
        )}
      </div>

      {/* Schwebender "Kunde hinzufuegen"-Button (nur Mobile, oberhalb der BottomNav) */}
      {canManageSelectedOrganization && (
        <button
          type="button"
          onClick={() => setShowCreateCustomer(true)}
          className="md:hidden fixed bottom-24 right-4 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-brown-600 hover:bg-brown-700 text-white shadow-lg shadow-brown-950/30 transition-colors"
          aria-label={t('addCustomerButton')}
          title={t('addCustomerButton')}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {isLoading && (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-4 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">{t('loadingCustomers')}</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
        </div>
      )}

      {!isLoading && customers.length > 0 ? (
        <div className="grid gap-3">
          {customers.map((customer) => (
            <CustomerItem key={customer.id} customer={customer} onSelect={selectCustomer} />
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">{t('noCustomersFound')}</p>
          </div>
        )
      )}

      {showCreateCustomer && (
        <CreateCustomerModal
          onClose={() => setShowCreateCustomer(false)}
          onCreated={(customer) => {
            setShowCreateCustomer(false);
            setReloadKey((k) => k + 1);
            selectCustomer(customer.id);
          }}
        />
      )}
    </section>
  );
};

export default Customers;
