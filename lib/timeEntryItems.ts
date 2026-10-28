import type { TimeEntryItem, TimeEntryItemType } from '@/lib/api/timeEntries'
import { formatChf, formatQuantity, parseChfToRappen, parseQuantity } from '@/lib/format/money'

/** Eine Eingabezeile im Formular (Texte, wie getippt). */
export interface ItemRow {
  quantity: string
  description: string
  price: string
}

export const emptyRow = (): ItemRow => ({ quantity: '', description: '', price: '' })

export const isRowEmpty = (row: ItemRow) => !row.quantity.trim() && !row.description.trim() && !row.price.trim()

/** Leere Zeilen entfernen und genau eine leere Zeile ans Ende haengen. */
export function withTrailingEmptyRow(rows: ItemRow[]): ItemRow[] {
  return [...rows.filter((row) => !isRowEmpty(row)), emptyRow()]
}

/** Bestehende Positionen (z.B. beim Bearbeiten) in Eingabezeilen umwandeln. */
export function itemsToRows(items: TimeEntryItem[] | undefined, type: TimeEntryItemType): ItemRow[] {
  return withTrailingEmptyRow(
    (items ?? [])
      .filter((item) => item.type === type)
      .map((item) => ({
        quantity: formatQuantity(item.quantity),
        description: item.description,
        // Ohne Preis erfasst (0) -> Feld leer lassen
        price: item.unitPriceRappen ? formatChf(item.unitPriceRappen) : '',
      })),
  )
}

export type ItemInput = Omit<TimeEntryItem, 'id'>

/**
 * Ausgefuellte Zeilen -> Positionen fuer die API. Leere Zeilen werden
 * ignoriert. Gibt null zurueck, wenn eine Zeile unvollstaendig/ungueltig ist
 * (Bezeichnung fehlt, Menge oder Preis nicht lesbar). Menge leer = 1, Preis
 * leer = ohne Preis (0).
 */
export function rowsToItems(rows: ItemRow[], type: TimeEntryItemType): ItemInput[] | null {
  const items: ItemInput[] = []
  for (const row of rows) {
    if (isRowEmpty(row)) continue
    const quantity = parseQuantity(row.quantity)
    const unitPriceRappen = row.price.trim() ? parseChfToRappen(row.price) : 0
    const description = row.description.trim()
    if (!description || quantity === null || unitPriceRappen === null) return null
    items.push({ type, quantity, description, unitPriceRappen })
  }
  return items
}

/** Summe in Rappen (Menge x Stueckpreis, auf Rappen gerundet). */
export function itemsTotalRappen(items: Pick<TimeEntryItem, 'quantity' | 'unitPriceRappen'>[]): number {
  return items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceRappen), 0)
}

/** Summe Material bzw. Spesen ueber mehrere Eintraege, in Rappen. */
export function entriesCostTotals(entries: { items?: TimeEntryItem[] }[]): { material: number; expense: number } {
  const all = entries.flatMap((entry) => entry.items ?? [])
  return {
    material: itemsTotalRappen(all.filter((item) => item.type === 'material')),
    expense: itemsTotalRappen(all.filter((item) => item.type === 'expense')),
  }
}
