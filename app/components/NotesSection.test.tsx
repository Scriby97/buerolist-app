// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { NotesSection } from './NotesSection'
import type { Note } from '@/lib/api/notes'

const addNotePhoto = vi.fn()
const resizePhoto = vi.fn()

vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ isAdmin: false, userProfile: { id: 'me' } }) }))
vi.mock('@/lib/contexts/OrganizationContext', () => ({
  useOrganization: () => ({ canManageSelectedOrganization: true }),
}))
vi.mock('@/lib/api/notes', () => ({
  createNote: vi.fn(),
  deleteNote: vi.fn(),
  deleteNotePhoto: vi.fn(),
  addNotePhoto: (...args: unknown[]) => addNotePhoto(...args),
}))
vi.mock('@/lib/images/resizeImage', () => {
  class ImageValidationError extends Error {}
  return { ImageValidationError, resizePhoto: (...args: unknown[]) => resizePhoto(...args) }
})

const note = {
  id: 'n1',
  text: 'Baustelle',
  authorId: 'me',
  author: { id: 'me', firstName: 'Martin', lastName: 'Germann' },
  createdAt: '2026-11-01T10:00:00.000Z',
  photos: [],
} as unknown as Note

function Harness() {
  const [notes, setNotes] = useState<Note[]>([note])
  return (
    <>
      <NotesSection projectId="p1" notes={notes} onChanged={setNotes} />
      <output data-testid="count">{notes[0].photos.length}</output>
    </>
  )
}

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

describe('NotesSection - Fotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resizePhoto.mockImplementation((f: File) => Promise.resolve(new Blob([f.name], { type: 'image/jpeg' })))
    let id = 0
    addNotePhoto.mockImplementation(() => Promise.resolve({ id: `ph${++id}`, url: `https://x/${id}.jpg` }))
  })

  it('laedt mehrere Fotos auf einmal hoch', async () => {
    renderWithIntl(<Harness />)
    fireEvent.change(screen.getByLabelText('Fotos hinzufügen'), {
      target: { files: [file('a.jpg'), file('b.jpg'), file('c.jpg')] },
    })
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('3'))
    expect(addNotePhoto).toHaveBeenCalledTimes(3)
  })

  it('meldet fehlgeschlagene Fotos und behaelt die erfolgreichen', async () => {
    resizePhoto.mockImplementation((f: File) =>
      f.name === 'b.jpg' ? Promise.reject(new Error('boom')) : Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
    )
    renderWithIntl(<Harness />)
    fireEvent.change(screen.getByLabelText('Fotos hinzufügen'), {
      target: { files: [file('a.jpg'), file('b.jpg'), file('c.jpg')] },
    })
    expect(await screen.findByText(/1 von 3 Fotos konnten nicht hochgeladen werden/)).toBeTruthy()
    expect(screen.getByTestId('count').textContent).toBe('2')
  })
})
