import type { TimeEntry } from '@/lib/api/timeEntries'
import { formatProjectNumber } from '@/lib/format/numbers'
import { itemsTotalRappen } from '@/lib/timeEntryItems'

// Aufbereitung der Zeiteintraege fuer druckbare Rapporte (Mitarbeiter-
// und Projekt-Rapport) - reine Funktionen, damit testbar.

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Lokales Datum als YYYY-MM-DD */
export const localDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** Erster und letzter Tag eines Monats (month 1-12) als YYYY-MM-DD. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(year, month, 0).getDate()
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(last)}` }
}

/** Zeitraum (inkl. ganzer Tage) als ISO-Grenzen fuer die API. */
export function rangeToIso(from: string, to: string): { startDate: string; endDate: string } {
  return {
    startDate: new Date(`${from}T00:00:00`).toISOString(),
    endDate: new Date(`${to}T23:59:59.999`).toISOString(),
  }
}

export const entryMinutes = (entry: Pick<TimeEntry, 'startAt' | 'endAt'>) =>
  Math.max(0, Math.round((new Date(entry.endAt).getTime() - new Date(entry.startAt).getTime()) / 60_000))

/** 510 -> "8:30" */
export const formatHm = (minutes: number) => `${Math.floor(minutes / 60)}:${pad2(minutes % 60)}`

export const formatTime = (iso: string) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export const projectLabel = (entry: TimeEntry) => {
  const number = formatProjectNumber(entry.project.customerNumber, entry.project.number)
  const name = `${entry.project.customerName} – ${entry.project.title}`
  return number ? `${number} ${name}` : name
}

export interface ReportDay {
  key: string
  date: Date
  entries: TimeEntry[]
  minutes: number
}

export interface ProjectTotal {
  projectId: string
  label: string
  minutes: number
  materialRappen: number
  expenseRappen: number
}

export interface ReportData {
  /** Tage aufsteigend, Eintraege je Tag zeitlich aufsteigend */
  days: ReportDay[]
  totalMinutes: number
  materialRappen: number
  expenseRappen: number
  /** Nach Projektnummer sortiert */
  projects: ProjectTotal[]
}

export function buildReportData(entries: TimeEntry[]): ReportData {
  const sorted = [...entries].sort((a, b) => a.startAt.localeCompare(b.startAt))
  const days = new Map<string, ReportDay>()
  const projects = new Map<string, ProjectTotal & { sortKey: string }>()
  let totalMinutes = 0
  let materialRappen = 0
  let expenseRappen = 0

  for (const entry of sorted) {
    const start = new Date(entry.startAt)
    const key = localDateKey(start)
    const minutes = entryMinutes(entry)
    const items = entry.items ?? []
    const material = itemsTotalRappen(items.filter((i) => i.type === 'material'))
    const expense = itemsTotalRappen(items.filter((i) => i.type === 'expense'))

    let day = days.get(key)
    if (!day) {
      day = { key, date: new Date(start.getFullYear(), start.getMonth(), start.getDate()), entries: [], minutes: 0 }
      days.set(key, day)
    }
    day.entries.push(entry)
    day.minutes += minutes

    let project = projects.get(entry.projectId)
    if (!project) {
      project = {
        projectId: entry.projectId,
        label: projectLabel(entry),
        minutes: 0,
        materialRappen: 0,
        expenseRappen: 0,
        sortKey: `${String(entry.project.customerNumber ?? 999999).padStart(6, '0')}-${String(entry.project.number ?? 999999).padStart(6, '0')}-${entry.project.title}`,
      }
      projects.set(entry.projectId, project)
    }
    project.minutes += minutes
    project.materialRappen += material
    project.expenseRappen += expense

    totalMinutes += minutes
    materialRappen += material
    expenseRappen += expense
  }

  return {
    days: [...days.values()],
    totalMinutes,
    materialRappen,
    expenseRappen,
    projects: [...projects.values()]
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey: _sortKey, ...rest }) => rest),
  }
}
