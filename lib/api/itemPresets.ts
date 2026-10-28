import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'
import type { TimeEntryItemType } from './timeEntries'

/** Vordefinierte Material-/Spesen-Position der Organisation (z.B. S-001 Mittagessen). */
export interface ItemPreset {
  id: string
  organizationId: string
  type: TimeEntryItemType
  /** Fortlaufend pro Organisation und Typ, Anzeige M-001 / S-001 */
  number: number
  description: string
  /** Stueckpreis in Rappen, null = ohne Preis */
  unitPriceRappen: number | null
}

export async function getItemPresets(organizationId: string): Promise<ItemPreset[]> {
  const url = new URL(buildApiUrl('/item-presets'))
  url.searchParams.set('organizationId', organizationId)
  const res = await authenticatedFetch(url.toString())
  if (!res.ok) await throwApiError(res, 'Fehler beim Laden der Vorlagen')
  return res.json()
}

export async function createItemPreset(data: {
  organizationId: string
  type: TimeEntryItemType
  description: string
  unitPriceRappen: number | null
}): Promise<ItemPreset> {
  const res = await authenticatedFetch(buildApiUrl('/item-presets'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Fehler beim Speichern der Vorlage')
  return res.json()
}

export async function updateItemPreset(
  id: string,
  data: { description: string; unitPriceRappen: number | null },
): Promise<ItemPreset> {
  const res = await authenticatedFetch(buildApiUrl(`/item-presets/${id}`), {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) await throwApiError(res, 'Fehler beim Speichern der Vorlage')
  return res.json()
}

export async function deleteItemPreset(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/item-presets/${id}`), { method: 'DELETE' })
  if (!res.ok) await throwApiError(res, 'Fehler beim Löschen der Vorlage')
}
