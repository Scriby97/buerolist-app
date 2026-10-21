// CHF-Betraege: im Backend als ganze Rappen (1040 = CHF 10.40), in der App
// mit Punkt oder Komma eingebbar.

/** 1040 -> "10.40" */
export function formatChf(rappen: number): string {
  return (rappen / 100).toFixed(2)
}

// Preis: CHF mit max. 2 Nachkommastellen; Menge: ganze Zahl oder max. 1
// Nachkommastelle. Punkt oder Komma als Dezimaltrenner.
// Ein Trennzeichen ohne Nachkommastelle ("10.") ist erlaubt - so wird beim
// Tippen nichts voreilig als ungueltig markiert.
const PRICE = /^\d+([.,]\d{0,2})?$/
const QUANTITY = /^\d+([.,]\d?)?$/

/** "10.40" / "10,4" / "10" -> 1040 / 1040 / 1000; ungueltig -> null */
export function parseChfToRappen(text: string): number | null {
  const trimmed = text.trim()
  if (!PRICE.test(trimmed)) return null
  return Math.round(Number(trimmed.replace(',', '.')) * 100)
}

/** "2" / "1,5" -> 2 / 1.5; leer -> 1; ungueltig oder 0 -> null */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return 1
  if (!QUANTITY.test(trimmed)) return null
  const value = Number(trimmed.replace(',', '.'))
  return value > 0 ? value : null
}

/**
 * Bereinigt eine Zahl-Eingabe waehrend des Tippens: nur Ziffern und ein
 * Dezimaltrenner, hoechstens `maxDecimals` Nachkommastellen. So laesst sich
 * z.B. bei der Menge keine zweite Nachkommastelle und kein Buchstabe tippen.
 */
export function sanitizeDecimalInput(text: string, maxDecimals: number): string {
  const cleaned = text.replace(/[^\d.,]/g, '')
  const separatorIndex = cleaned.search(/[.,]/)
  if (separatorIndex === -1) return cleaned
  const integerPart = cleaned.slice(0, separatorIndex)
  const separator = cleaned[separatorIndex]
  const decimals = cleaned.slice(separatorIndex + 1).replace(/[.,]/g, '').slice(0, maxDecimals)
  return `${integerPart || '0'}${separator}${decimals}`
}

/** Menge fuer die Anzeige: 1 -> "1", 1.5 -> "1.5" */
export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)))
}
