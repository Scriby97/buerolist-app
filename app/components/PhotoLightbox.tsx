'use client';

import { useEffect, useRef, useState, type FC } from 'react';

interface PhotoLightboxProps {
  photos: { id: string; url: string }[];
  startIndex: number;
  onClose: () => void;
  // Wie bei ConfirmDialog: Labels immer uebersetzt vom Aufrufer.
  closeLabel: string;
  previousLabel: string;
  nextLabel: string;
}

// Mindest-Wischdistanz in px, ab der ein horizontaler Swipe blaettert.
const SWIPE_THRESHOLD = 50;

/**
 * Vollbild-Ansicht fuer Fotos (z.B. an Notizen). Schliessen per X, Escape
 * oder Tipp auf den Hintergrund; blaettern per Pfeil-Buttons, Pfeiltasten
 * oder Wischen.
 */
export const PhotoLightbox: FC<PhotoLightboxProps> = ({
  photos,
  startIndex,
  onClose,
  closeLabel,
  previousLabel,
  nextLabel,
}) => {
  const [index, setIndex] = useState(startIndex);
  const touchStartX = useRef<number | null>(null);
  const hasMultiple = photos.length > 1;

  const showPrevious = () => setIndex((i) => (i - 1 + photos.length) % photos.length);
  const showNext = () => setIndex((i) => (i + 1) % photos.length);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + photos.length) % photos.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % photos.length);
    };
    document.addEventListener('keydown', handleKeyDown);
    // Hintergrund-Seite waehrend der Ansicht nicht scrollen lassen.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, photos.length]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const startX = touchStartX.current;
        touchStartX.current = null;
        const endX = e.changedTouches[0]?.clientX;
        if (!hasMultiple || startX === null || endX === undefined) return;
        const dx = endX - startX;
        if (dx > SWIPE_THRESHOLD) showPrevious();
        if (dx < -SWIPE_THRESHOLD) showNext();
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt=""
        className="max-h-[90dvh] max-w-[95vw] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label={closeLabel}
        title={closeLabel}
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); showPrevious(); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label={previousLabel}
            title={previousLabel}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); showNext(); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label={nextLabel}
            title={nextLabel}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white tabular-nums">
            {index + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  );
};
