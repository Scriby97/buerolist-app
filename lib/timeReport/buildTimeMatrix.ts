import type { TimeEntry } from '@/lib/api/timeEntries'

// Aufbereitung der Zeiteintraege eines Projekts fuer die Zeitaufstellung
// (Matrix Tage x Mitarbeiter, gruppiert nach Kalenderwoche) - bewusst als
// reine Funktion ausserhalb der Komponente, damit sie testbar ist.

export interface MatrixEmployee {
  id: string
  name: string
}

export interface MatrixDay {
  /** Lokales Datum YYYY-MM-DD */
  key: string
  date: Date
  minutesByEmployee: Record<string, number>
  totalMinutes: number
  /** Eintraege des Tages, zeitlich aufsteigend */
  entries: TimeEntry[]
}

export interface MatrixWeek {
  /** z.B. "2026-W41" */
  key: string
  isoYear: number
  isoWeek: number
  minutesByEmployee: Record<string, number>
  totalMinutes: number
  /** Tage der Woche, neueste zuerst */
  days: MatrixDay[]
}

export interface TimeMatrix {
  employees: MatrixEmployee[]
  /** Wochen, neueste zuerst */
  weeks: MatrixWeek[]
  minutesByEmployee: Record<string, number>
  totalMinutes: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** ISO-8601-Kalenderwoche (Woche beginnt am Montag, KW 1 enthaelt den 4. Januar). */
export function isoWeek(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const weekday = d.getUTCDay() || 7 // Montag = 1 ... Sonntag = 7
  d.setUTCDate(d.getUTCDate() + 4 - weekday) // Donnerstag dieser Woche
  const isoYear = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return { isoYear, isoWeek: week }
}

function employeeName(entry: TimeEntry, fallback: string): string {
  const { firstName, lastName, email } = entry.creator
  const name = `${firstName ?? ''} ${lastName ?? ''}`.trim()
  return name || email || fallback
}

function minutesOf(entry: TimeEntry): number {
  return Math.max(0, Math.round((new Date(entry.endAt).getTime() - new Date(entry.startAt).getTime()) / 60_000))
}

function add(record: Record<string, number>, key: string, minutes: number) {
  record[key] = (record[key] ?? 0) + minutes
}

export function buildTimeMatrix(entries: TimeEntry[], unknownEmployeeName = '?'): TimeMatrix {
  const employees = new Map<string, MatrixEmployee>()
  const weeks = new Map<string, MatrixWeek>()
  const days = new Map<string, MatrixDay>()
  const minutesByEmployee: Record<string, number> = {}
  let totalMinutes = 0

  for (const entry of entries) {
    const start = new Date(entry.startAt)
    const minutes = minutesOf(entry)
    const employeeId = entry.creatorId

    if (!employees.has(employeeId)) {
      employees.set(employeeId, { id: employeeId, name: employeeName(entry, unknownEmployeeName) })
    }

    const { isoYear, isoWeek: week } = isoWeek(start)
    const weekKey = `${isoYear}-W${pad2(week)}`
    let weekGroup = weeks.get(weekKey)
    if (!weekGroup) {
      weekGroup = { key: weekKey, isoYear, isoWeek: week, minutesByEmployee: {}, totalMinutes: 0, days: [] }
      weeks.set(weekKey, weekGroup)
    }

    const dayKey = localDateKey(start)
    let day = days.get(dayKey)
    if (!day) {
      day = {
        key: dayKey,
        date: new Date(start.getFullYear(), start.getMonth(), start.getDate()),
        minutesByEmployee: {},
        totalMinutes: 0,
        entries: [],
      }
      days.set(dayKey, day)
      weekGroup.days.push(day)
    }

    day.entries.push(entry)
    add(day.minutesByEmployee, employeeId, minutes)
    day.totalMinutes += minutes
    add(weekGroup.minutesByEmployee, employeeId, minutes)
    weekGroup.totalMinutes += minutes
    add(minutesByEmployee, employeeId, minutes)
    totalMinutes += minutes
  }

  const byStartAsc = (a: TimeEntry, b: TimeEntry) =>
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  const sortedWeeks = [...weeks.values()].sort((a, b) => b.key.localeCompare(a.key))
  for (const week of sortedWeeks) {
    week.days.sort((a, b) => b.key.localeCompare(a.key))
    for (const day of week.days) day.entries.sort(byStartAsc)
  }

  return {
    // Mitarbeiter mit den meisten Stunden zuerst.
    employees: [...employees.values()].sort(
      (a, b) => (minutesByEmployee[b.id] ?? 0) - (minutesByEmployee[a.id] ?? 0) || a.name.localeCompare(b.name),
    ),
    weeks: sortedWeeks,
    minutesByEmployee,
    totalMinutes,
  }
}

/** Kompakte Stunden fuer Matrix-Zellen: 510 -> "8:30", 0 -> "". */
export function formatHoursMinutes(minutes: number): string {
  if (!minutes) return ''
  return `${Math.floor(minutes / 60)}:${pad2(minutes % 60)}`
}
