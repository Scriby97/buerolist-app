'use client';

import { useEffect, useState, type FC } from 'react';

interface ConfirmDialogProps {
  // Kein deutscher Default mehr - Aufrufer muessen die Labels immer explizit
  // (uebersetzt) uebergeben, damit ein vergessener Aufruf nicht still auf
  // Deutsch zurueckfaellt, egal welche Sprache der User eingestellt hat.
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  // Für besonders schwerwiegende Aktionen (z.B. Organisation löschen): der
  // Bestätigen-Button bleibt disabled, bis der User diesen exakten Text in
  // ein Eingabefeld getippt hat.
  requireTypedConfirmation?: string;
  typedConfirmationLabel?: string;
}

/**
 * Accessible modal confirmation dialog.
 * Replaces the native window.confirm() for a consistent, keyboard-navigable UX.
 */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  requireTypedConfirmation,
  typedConfirmationLabel,
}) => {
  const [typedValue, setTypedValue] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const isConfirmDisabled =
    requireTypedConfirmation !== undefined && typedValue !== requireTypedConfirmation;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-sm w-full shadow-xl space-y-4">
        <h3
          id="confirm-dialog-title"
          className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
        >
          {title}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
        {requireTypedConfirmation !== undefined && (
          <div>
            {typedConfirmationLabel && (
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                {typedConfirmationLabel}
              </label>
            )}
            <input
              type="text"
              value={typedValue}
              onChange={(event) => setTypedValue(event.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm dark:bg-zinc-700 dark:text-zinc-100"
              autoComplete="off"
            />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
