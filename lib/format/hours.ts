/**
 * Dezimalstunden-Eingabe in Minuten: "1.25" / "1,25" -> 75, "" -> null.
 * undefined bei ungueltiger Eingabe (keine Zahl, negativ, ueber 24 h).
 */
export function parseDecimalHours(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.')
  if (!trimmed) return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return undefined
  const minutes = Math.round(Number(trimmed) * 60)
  return minutes <= 24 * 60 ? minutes : undefined
}

/** Minuten fuer ein Eingabefeld: 75 -> "1.25", null -> "". */
export function minutesToDecimalInput(minutes: number | null | undefined): string {
  return minutes ? String(Number((minutes / 60).toFixed(2))) : ''
}

/** Minuten als Dezimalstunden mit zwei Stellen: 585 -> "9.75", 270 -> "4.50". */
export function formatDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2)
}
