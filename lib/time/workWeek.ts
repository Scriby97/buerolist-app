// Gegenstueck zu buerolist-server/src/common/utils/work-week.util.ts:
// Mitarbeiter duerfen eigene Eintraege nur in der laufenden Woche (ab Montag
// 00:00) bearbeiten/loeschen. Hier im lokalen Kalender des Geraets gerechnet
// (Nutzer sind in der Schweiz) - nur fuer die Anzeige; durchgesetzt wird die
// Regel im Backend.

const pad2 = (n: number) => String(n).padStart(2, '0')
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** Montag der laufenden Woche als "YYYY-MM-DD". */
export function currentWeekStartKey(now: Date = new Date()): string {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekday = monday.getDay() || 7 // Montag = 1 ... Sonntag = 7
  monday.setDate(monday.getDate() - (weekday - 1))
  return dateKey(monday)
}

/** Liegt der Zeitpunkt in der laufenden Woche (oder spaeter)? */
export function isInCurrentWeek(iso: string, now: Date = new Date()): boolean {
  return dateKey(new Date(iso)) >= currentWeekStartKey(now)
}
