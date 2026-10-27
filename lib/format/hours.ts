/** Minuten als Dezimalstunden mit zwei Stellen: 585 -> "9.75", 270 -> "4.50". */
export function formatDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2)
}
