'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import Breadcrumbs from '@/app/components/Breadcrumbs'

export default function ImpressumPage() {
  const t = useTranslations('impressum')

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: t('title') }]} />

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {t('title')}
          </h1>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-6 space-y-6">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('providerTitle')}
            </h2>
            <p className="mt-2 text-zinc-900 dark:text-zinc-50">
              Deerworks by Nicolas Balmer<br />
              Aegertenstrasse 24<br />
              3702 Hondrich<br />
              Schweiz
            </p>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('contactTitle')}
            </h2>
            <p className="mt-2 text-zinc-900 dark:text-zinc-50">
              <a
                href="mailto:nico.balmer@outlook.com"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                nico.balmer@outlook.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t('developedByTitle')}
            </h2>
            <p className="mt-2 text-zinc-900 dark:text-zinc-50">
              {t('developedByText')}{' '}
              <a
                href="https://deerworks.ch"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                deerworks.ch
              </a>
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          &larr; {t('backToApp')}
        </Link>
      </div>
    </div>
  )
}
