import { authenticatedFetch } from './authenticatedFetch'
import { buildApiUrl } from './url'
import { throwApiError } from './ApiError'

export interface NotePhoto {
  id: string
  noteId: string
  url: string
  createdAt: string
}

export interface Note {
  id: string
  organizationId: string
  customerId: string | null
  projectId: string | null
  authorId: string
  text: string
  createdAt: string
  photos: NotePhoto[]
}

/**
 * Notiz an einem Kunden ODER einem Projekt anlegen - genau eines der beiden
 * Felder setzen (siehe CreateNoteDto im Backend).
 */
export async function createNote(data: {
  customerId?: string
  projectId?: string
  text: string
}): Promise<Note> {
  const res = await authenticatedFetch(buildApiUrl('/notes'), {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Anlegen der Notiz')
  }
  return res.json()
}

export async function addNotePhoto(noteId: string, file: Blob): Promise<NotePhoto> {
  const form = new FormData()
  form.append('file', file, 'photo.webp')

  const res = await authenticatedFetch(buildApiUrl(`/notes/${noteId}/photos`), {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Hochladen des Fotos')
  }
  return res.json()
}

export async function deleteNotePhoto(noteId: string, photoId: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/notes/${noteId}/photos/${photoId}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Löschen des Fotos')
  }
}

export async function deleteNote(id: string): Promise<void> {
  const res = await authenticatedFetch(buildApiUrl(`/notes/${id}`), {
    method: 'DELETE',
  })
  if (!res.ok) {
    await throwApiError(res, 'Fehler beim Löschen der Notiz')
  }
}
