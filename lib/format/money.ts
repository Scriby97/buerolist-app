// CHF-Betraege: im Backend als ganze Rappen (1040 = CHF 10.40), in der App
// mit Punkt oder Komma eingebbar.

/** 1040 -> "10.40" */
export function formatChf(rappen: number): string {
  return (rappen / 100).toFixed(2)
}

const DECIMAL = /^\d+([.,]\d{0,2})?$/

/** "10.40" / "10,4" / "10" -> 1040 / 1040 / 1000; ungueltig -> null */
export function parseChfToRappen(text: string): number | null {
  const trimmed = text.trim()
  if (!DECIMAL.test(trimmed)) return null
  return Math.round(Number(trimmed.replace(',', '.')) * 100)
}

/** "2" / "1,5" -> 2 / 1.5; leer -> 1; ungueltig oder 0 -> null */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return 1
  if (!DECIMAL.test(trimmed)) return null
  const value = Number(trimmed.replace(',', '.'))
  return value > 0 ? value : null
}

/** Menge fuer die Anzeige: 1 -> "1", 1.5 -> "1.5" */
export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)))
}
