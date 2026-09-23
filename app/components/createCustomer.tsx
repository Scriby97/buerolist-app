'use client';

import { useState, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { createCustomer, type Customer } from '@/lib/api/customers';

interface CreateCustomerModalProps {
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

const CreateCustomerModal: FC<CreateCustomerModalProps> = ({ onClose, onCreated }) => {
  const t = useTranslations('createCustomer');
  const tCommon = useTranslations('common');
  const { selectedOrgId } = useOrganization();
  const getApiErrorMessage = useApiErrorMessage();

  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !selectedOrgId) return;
    setSubmitting(true);
    setError(null);
    try {
      const customer = await createCustomer({
        name: name.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        address: address.trim() || undefined,
        organizationId: selectedOrgId,
      });
      onCreated(customer);
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
            <label htmlFor="customerName" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('nameLabel')}
            </label>
            <input
              id="customerName"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500"
              placeholder={t('namePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="customerEmail" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('emailLabel')}
            </label>
            <input
              id="customerEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="customerPhone" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('phoneLabel')}
            </label>
            <input
              id="customerPhone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="customerAddress" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('addressLabel')}
            </label>
            <textarea
              id="customerAddress"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

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
              disabled={submitting || !name.trim()}
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

export default CreateCustomerModal;
