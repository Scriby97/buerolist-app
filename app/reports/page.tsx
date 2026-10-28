'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Breadcrumbs from '@/app/components/Breadcrumbs'
import { DateInput } from '@/app/components/DateInput'
import { ProjectCombobox } from '@/app/components/ProjectCombobox'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { useDateLocale } from '@/lib/i18n/formatDate'
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage'
import { getOrganizationMembers } from '@/lib/api/organizationMembers'
import { getProjectDetail, getProjects, type Project, type ProjectDetail } from '@/lib/api/projects'
import { getTimeEntries, type TimeEntry } from '@/lib/api/timeEntries'
import { getCustomerDetail } from '@/lib/api/customers'
import type { Note } from '@/lib/api/notes'
import type { OrganizationMemberDetail } from '@/lib/types/user'
import { projectDisplayName } from '@/lib/format/numbers'
import { monthRange, rangeToIso } from '@/lib/reports/reportData'
import { formatDateCH } from '@/app/components/DateInput'
import { EmployeeReport, type EmployeeReportOptions } from './EmployeeReport'
import { ProjectReport, type ProjectReportOptions } from './ProjectReport'
import { personName } from '@/lib/format/personName'

const fieldClass =
  'px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'

const memberName = (m: OrganizationMemberDetail) => personName(m.user, '?')

function ReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading: authLoading } = useAuth()
  const { organizations, selectedOrgId, canManageSelectedOrganization, isLoading: orgLoading } = useOrganization()
  const t = useTranslations('reports')
  const dateLocale = useDateLocale()
  const getApiErrorMessage = useApiErrorMessage()

  const now = new Date()
  const [members, setMembers] = useState<OrganizationMemberDetail[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [reportType, setReportType] = useState<'employee' | 'project'>(
    searchParams.get('type') === 'project' ? 'project' : 'employee',
  )
  const [creatorId, setCreatorId] = useState(searchParams.get('creatorId') ?? '')
  // 'all' (ganzes Projekt) gibt es nur beim Projekt-Rapport
  const [periodMode, setPeriodMode] = useState<'all' | 'month' | 'range'>(reportType === 'project' ? 'all' : 'month')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [from, setFrom] = useState(monthRange(now.getFullYear(), now.getMonth() + 1).from)
  const [to, setTo] = useState(monthRange(now.getFullYear(), now.getMonth() + 1).to)
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '')
  const [options, setOptions] = useState<EmployeeReportOptions>({
    category: true,
    comment: true,
    items: true,
    dayTotals: true,
    projectSummary: true,
  })
  const [projectOptions, setProjectOptions] = useState<ProjectReportOptions>({
    summary: true,
    chart: true,
    costs: true,
    entries: true,
    comments: true,
    notes: false,
    photos: false,
  })
  // Ergebnis gehoert zu einer bestimmten Auswahl - aendert sich die Auswahl,
  // verschwindet die alte Vorschau automatisch.
  const [result, setResult] = useState<{
    key: string
    entries: TimeEntry[]
    detail?: ProjectDetail
    customerNotes?: Note[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Nur Admin/Owner
  useEffect(() => {
    if (authLoading || orgLoading) return
    if (!canManageSelectedOrganization) router.push('/')
  }, [authLoading, orgLoading, canManageSelectedOrganization, router])

  useEffect(() => {
    if (!selectedOrgId || !canManageSelectedOrganization) return
    getOrganizationMembers(selectedOrgId)
      .then((list) => {
        const sorted = [...list].sort((a, b) => memberName(a).localeCompare(memberName(b)))
        setMembers(sorted)
        setCreatorId((current) => current || sorted[0]?.userId || '')
      })
      .catch(() => setMembers([]))
    getProjects(selectedOrgId)
      .then(setProjects)
      .catch(() => setProjects([]))
  }, [selectedOrgId, canManageSelectedOrganization])

  const effectiveMode = reportType === 'employee' && periodMode === 'all' ? 'month' : periodMode
  const period = effectiveMode === 'all' ? null : effectiveMode === 'month' ? monthRange(year, month) : { from, to }
  const periodLabel =
    effectiveMode === 'all'
      ? t('periodAllLabel')
      : effectiveMode === 'month'
        ? new Date(year, month - 1, 1).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' })
        : `${formatDateCH(from)} – ${formatDateCH(to)}`
  const member = members.find((m) => m.userId === creatorId)
  const project = projects.find((p) => p.id === projectId)
  const organizationName = organizations.find((o) => o.id === selectedOrgId)?.name ?? ''

  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString(dateLocale, { month: 'long' })),
    [dateLocale],
  )

  const selectionKey = [reportType, reportType === 'employee' ? creatorId : '', period?.from, period?.to, projectId].join('|')
  const current = result?.key === selectionKey ? result : null
  const entries = current?.entries ?? null
  const canCreate =
    (reportType === 'employee' ? Boolean(creatorId) : Boolean(projectId)) &&
    (effectiveMode !== 'range' || (Boolean(from) && Boolean(to) && to >= from))

  const createReport = async () => {
    if (!selectedOrgId || !canCreate) return
    setLoading(true)
    setError(null)
    try {
      const range = period ? rangeToIso(period.from, period.to) : {}
      if (reportType === 'employee') {
        const page = await getTimeEntries(selectedOrgId, { creatorId, ...range, projectId: projectId || undefined })
        setResult({ key: selectionKey, entries: page.timeEntries })
      } else {
        const customerId = projects.find((p) => p.id === projectId)?.customerId
        const [detail, page, customer] = await Promise.all([
          getProjectDetail(projectId),
          getTimeEntries(selectedOrgId, { projectId, ...range }),
          // Kunden-Notizen/Fotos sind optional - fehlen sie, kommt der Rapport trotzdem
          customerId ? getCustomerDetail(customerId).catch(() => null) : null,
        ])
        setResult({ key: selectionKey, entries: page.timeEntries, detail, customerNotes: customer?.notes ?? [] })
      }
    } catch (err) {
      setError(getApiErrorMessage(err, t('loadError')))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || orgLoading || !canManageSelectedOrganization) {
    return null
  }

  const optionKeys: (keyof EmployeeReportOptions)[] = ['category', 'comment', 'items', 'dayTotals', 'projectSummary']
  const projectOptionKeys: (keyof ProjectReportOptions)[] = ['summary', 'chart', 'costs', 'entries', 'comments', 'notes', 'photos']
  const projectComboboxOptions = projects.map((p) => ({
    id: p.id,
    title: p.title,
    number: p.number,
    customerName: p.customer?.name,
    customerNumber: p.customer?.number,
  }))
  const switchType = (type: 'employee' | 'project') => {
    setReportType(type)
    setPeriodMode(type === 'project' ? 'all' : 'month')
  }

  return (
    <div className="min-h-dvh bg-zinc-50 dark:bg-zinc-900 px-4 pt-20 pb-24 md:pt-8 md:pb-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-6 print:hidden">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', href: '/' },
              { label: t('title') },
            ]}
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">{t('title')}</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 space-y-5">
            <div className="inline-flex rounded-lg border border-zinc-300 dark:border-zinc-600 p-0.5 text-sm" role="tablist">
              {(['employee', 'project'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={reportType === type}
                  onClick={() => switchType(type)}
                  className={`px-3 py-1.5 rounded-md font-medium ${
                    reportType === type
                      ? 'bg-brown-600 text-white'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                >
                  {t(type === 'employee' ? 'typeEmployee' : 'typeProject')}
                </button>
              ))}
            </div>

            {reportType === 'project' ? (
              <div className="space-y-1.5">
                <label htmlFor="reportProjectMain" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t('projectLabel')}
                </label>
                <ProjectCombobox
                  id="reportProjectMain"
                  value={projectId}
                  onChange={setProjectId}
                  placeholder={t('projectPlaceholder')}
                  noMatchesText={t('noProjectMatches')}
                  options={projectComboboxOptions}
                />
              </div>
            ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="reportEmployee" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t('employeeLabel')}
                </label>
                <select id="reportEmployee" value={creatorId} onChange={(e) => setCreatorId(e.target.value)} className={`w-full ${fieldClass}`}>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {memberName(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="reportProject" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t('projectFilterLabel')}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <ProjectCombobox
                      id="reportProject"
                      value={projectId}
                      onChange={setProjectId}
                      placeholder={t('allProjects')}
                      noMatchesText={t('noProjectMatches')}
                      options={projectComboboxOptions}
                    />
                  </div>
                  {projectId && (
                    <button type="button" onClick={() => setProjectId('')} className="px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600">
                      {t('allProjectsButton')}
                    </button>
                  )}
                </div>
              </div>
            </div>
            )}

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('periodLabel')}</legend>
              <div className="flex flex-wrap gap-4 text-sm text-zinc-700 dark:text-zinc-300">
                {reportType === 'project' && (
                  <label className="flex items-center gap-2">
                    <input type="radio" name="periodMode" checked={effectiveMode === 'all'} onChange={() => setPeriodMode('all')} />
                    {t('periodAll')}
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input type="radio" name="periodMode" checked={effectiveMode === 'month'} onChange={() => setPeriodMode('month')} />
                  {t('periodMonth')}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="periodMode" checked={effectiveMode === 'range'} onChange={() => setPeriodMode('range')} />
                  {t('periodRange')}
                </label>
              </div>
              {effectiveMode === 'all' ? null : effectiveMode === 'month' ? (
                <div className="flex gap-2">
                  <select aria-label={t('monthLabel')} value={month} onChange={(e) => setMonth(Number(e.target.value))} className={fieldClass}>
                    {monthNames.map((name, i) => (
                      <option key={i} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select aria-label={t('yearLabel')} value={year} onChange={(e) => setYear(Number(e.target.value))} className={fieldClass}>
                    {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 4 + i).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label htmlFor="reportFrom" className="text-xs text-zinc-500 dark:text-zinc-400">{t('fromLabel')}</label>
                    <DateInput id="reportFrom" value={from} onChange={setFrom} />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="reportTo" className="text-xs text-zinc-500 dark:text-zinc-400">{t('toLabel')}</label>
                    <DateInput id="reportTo" value={to} onChange={setTo} min={from} />
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('contentLabel')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {reportType === 'employee'
                  ? optionKeys.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={options[key]}
                          onChange={() => setOptions((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                        />
                        {t(`option_${key}`)}
                      </label>
                    ))
                  : projectOptionKeys.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={projectOptions[key]}
                          onChange={() => setProjectOptions((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                        />
                        {t(`projectOption_${key}`)}
                      </label>
                    ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={createReport}
                disabled={loading || !canCreate}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-brown-600 hover:bg-brown-700 text-white disabled:opacity-50"
              >
                {loading ? t('creating') : t('createButton')}
              </button>
              {entries && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  {t('printButton')}
                </button>
              )}
            </div>
            {entries && <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('printHint')}</p>}
            {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
          </div>
        </div>

        {current?.detail && (
          <ProjectReport
            detail={current.detail}
            customerNotes={current.customerNotes}
            entries={current.entries}
            organizationName={organizationName}
            periodLabel={periodLabel}
            options={projectOptions}
          />
        )}

        {entries && !current?.detail && (
          <EmployeeReport
            entries={entries}
            organizationName={organizationName}
            employeeName={member ? memberName(member) : ''}
            periodLabel={periodLabel}
            projectFilterLabel={project ? projectDisplayName(project, project.customer) : undefined}
            options={options}
          />
        )}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense fallback={null}>
      <ReportsPageContent />
    </Suspense>
  )
}
