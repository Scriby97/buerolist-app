'use client';

import { useState, type FC, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useDateLocale } from '@/lib/i18n/formatDate';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useOrganization } from '@/lib/contexts/OrganizationContext';
import { useApiErrorMessage } from '@/lib/i18n/useApiErrorMessage';
import { createNote, addNotePhoto, deleteNotePhoto, deleteNote, type Note } from '@/lib/api/notes';
import { resizeToSquareWebp, ImageValidationError } from '@/lib/images/resizeImage';
import { ConfirmDialog } from './ConfirmDialog';

interface NotesSectionProps {
  // Genau eines von beiden setzen - siehe CreateNoteDto im Backend.
  customerId?: string;
  projectId?: string;
  notes: Note[];
  onChanged: (notes: Note[]) => void;
}

/**
 * Notizen (mit Fotos) an einem Kunden oder einem Projekt - siehe Plan
 * "Datenmodell-Entscheidungen". Wird sowohl von CustomerDetail als auch von
 * ProjectDetail eingebunden.
 */
export const NotesSection: FC<NotesSectionProps> = ({ customerId, projectId, notes, onChanged }) => {
  const t = useTranslations('notesSection');
  const tCommon = useTranslations('common');
  const dateLocale = useDateLocale();
  const { userProfile, isAdmin } = useAuth();
  const { canManageSelectedOrganization } = useOrganization();
  const getApiErrorMessage = useApiErrorMessage();

  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingNoteId, setUploadingNoteId] = useState<string | null>(null);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);

  const canDelete = (note: Note) =>
    isAdmin || canManageSelectedOrganization || note.authorId === userProfile?.id;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const note = await createNote({ customerId, projectId, text: text.trim() });
      onChanged([note, ...notes]);
      setText('');
    } catch (err) {
      setError(getApiErrorMessage(err, t('createError')));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoPicked = async (noteId: string, file: File) => {
    setUploadingNoteId(noteId);
    setError(null);
    try {
      const blob = await resizeToSquareWebp(file);
      const photo = await addNotePhoto(noteId, blob);
      onChanged(
        notes.map((n) => (n.id === noteId ? { ...n, photos: [...n.photos, photo] } : n)),
      );
    } catch (err) {
      if (err instanceof ImageValidationError) {
        setError(t('photoInvalid'));
      } else {
        setError(getApiErrorMessage(err, t('photoUploadError')));
      }
    } finally {
      setUploadingNoteId(null);
    }
  };

  const handleDeletePhoto = async (noteId: string, photoId: string) => {
    try {
      await deleteNotePhoto(noteId, photoId);
      onChanged(
        notes.map((n) => (n.id === noteId ? { ...n, photos: n.photos.filter((p) => p.id !== photoId) } : n)),
      );
    } catch (err) {
      setError(getApiErrorMessage(err, t('photoDeleteError')));
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      onChanged(notes.filter((n) => n.id !== noteId));
    } catch (err) {
      setError(getApiErrorMessage(err, t('deleteError')));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{t('title')}</h2>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('placeholder')}
          rows={2}
          className="block w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50 focus:border-blue-500 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="px-4 py-1.5 text-sm font-medium rounded-lg bg-brown-600 hover:bg-brown-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? t('submitting') : t('submitButton')}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('noNotes')}</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-zinc-900 dark:text-zinc-50 whitespace-pre-wrap">{note.text}</p>
                {canDelete(note) && (
                  <button
                    onClick={() => setConfirmDeleteNoteId(note.id)}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                    title={tCommon('delete')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(note.createdAt).toLocaleString(dateLocale)}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {note.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                    {canDelete(note) && (
                      <button
                        onClick={() => handleDeletePhoto(note.id, photo.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={tCommon('delete')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                <label className="w-16 h-16 rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  {uploadingNoteId === note.id ? (
                    <span className="text-xs text-zinc-500">…</span>
                  ) : (
                    <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingNoteId === note.id}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handlePhotoPicked(note.id, file);
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDeleteNoteId && (
        <ConfirmDialog
          title={t('confirmDeleteTitle')}
          message={t('confirmDeleteMessage')}
          confirmLabel={tCommon('delete')}
          cancelLabel={tCommon('cancel')}
          onConfirm={() => { handleDeleteNote(confirmDeleteNoteId); setConfirmDeleteNoteId(null); }}
          onCancel={() => setConfirmDeleteNoteId(null)}
        />
      )}
    </div>
  );
};
