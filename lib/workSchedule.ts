/**
 * Normaler Arbeitstag eines Mitarbeiters (Einstellungen -> Arbeitszeiten):
 * Vormittag von/bis und Nachmittag von/bis, je "HH:MM".
 */
export interface WorkSchedule {
  workMorningStart: string
  workMorningEnd: string
  workAfternoonStart: string
  workAfternoonEnd: string
}

export const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  workMorningStart: '07:15',
  workMorningEnd: '12:00',
  workAfternoonStart: '13:00',
  workAfternoonEnd: '17:00',
}

/** Arbeitszeiten einer Person (Profil/Mitglied), fehlende Werte mit Default. */
export function scheduleOf(person: Partial<WorkSchedule> | null | undefined): WorkSchedule {
  return {
    workMorningStart: person?.workMorningStart || DEFAULT_WORK_SCHEDULE.workMorningStart,
    workMorningEnd: person?.workMorningEnd || DEFAULT_WORK_SCHEDULE.workMorningEnd,
    workAfternoonStart: person?.workAfternoonStart || DEFAULT_WORK_SCHEDULE.workAfternoonStart,
    workAfternoonEnd: person?.workAfternoonEnd || DEFAULT_WORK_SCHEDULE.workAfternoonEnd,
  }
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Aufsteigend? (Vormittag von < bis <= Nachmittag von < bis) */
export function isValidWorkSchedule(s: WorkSchedule): boolean {
  if (![s.workMorningStart, s.workMorningEnd, s.workAfternoonStart, s.workAfternoonEnd].every((v) => /^\d{2}:\d{2}$/.test(v))) {
    return false
  }
  const [a, b, c, d] = [s.workMorningStart, s.workMorningEnd, s.workAfternoonStart, s.workAfternoonEnd].map(toMinutes)
  return a < b && b <= c && c < d
}

/** Dauer eines normalen Arbeitstags in Minuten. */
export function workdayMinutes(s: WorkSchedule): number {
  return (
    toMinutes(s.workMorningEnd) - toMinutes(s.workMorningStart) + toMinutes(s.workAfternoonEnd) - toMinutes(s.workAfternoonStart)
  )
}

/**
 * Startzeit-Vorschlag fuer den naechsten Eintrag: neuer Tag (noch nichts
 * erfasst) -> Arbeitsbeginn; endet der letzte Eintrag bei Mittagspause-Beginn
 * -> Nachmittagsbeginn; sonst direkt anschliessend.
 */
export function suggestStartTime(lastEndTime: string, schedule: WorkSchedule): string {
  if (!lastEndTime) return schedule.workMorningStart
  if (lastEndTime === schedule.workMorningEnd) return schedule.workAfternoonStart
  return lastEndTime
}
