// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotoLightbox } from './PhotoLightbox';

const photos = [
  { id: 'p1', url: 'https://example.com/1.jpg' },
  { id: 'p2', url: 'https://example.com/2.jpg' },
  { id: 'p3', url: 'https://example.com/3.jpg' },
];

const renderLightbox = (onClose = vi.fn(), startIndex = 0) =>
  render(
    <PhotoLightbox
      photos={photos}
      startIndex={startIndex}
      onClose={onClose}
      closeLabel="Schliessen"
      previousLabel="Vorheriges Foto"
      nextLabel="Nächstes Foto"
    />,
  );

const currentSrc = () => screen.getByRole('dialog').querySelector('img')?.getAttribute('src');

describe('PhotoLightbox', () => {
  it('zeigt das Startfoto und blaettert mit den Buttons (zyklisch)', () => {
    renderLightbox(undefined, 2);
    expect(currentSrc()).toBe(photos[2].url);
    expect(screen.getByText('3 / 3')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Nächstes Foto'));
    expect(currentSrc()).toBe(photos[0].url);

    fireEvent.click(screen.getByLabelText('Vorheriges Foto'));
    expect(currentSrc()).toBe(photos[2].url);
  });

  it('blaettert mit den Pfeiltasten und schliesst mit Escape', () => {
    const onClose = vi.fn();
    renderLightbox(onClose);

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(currentSrc()).toBe(photos[1].url);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('schliesst bei Klick auf den Hintergrund, aber nicht bei Klick aufs Bild', () => {
    const onClose = vi.fn();
    renderLightbox(onClose);

    fireEvent.click(screen.getByRole('dialog').querySelector('img')!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('zeigt bei nur einem Foto keine Blaetter-Buttons', () => {
    render(
      <PhotoLightbox
        photos={[photos[0]]}
        startIndex={0}
        onClose={vi.fn()}
        closeLabel="Schliessen"
        previousLabel="Vorheriges Foto"
        nextLabel="Nächstes Foto"
      />,
    );
    expect(screen.queryByLabelText('Nächstes Foto')).toBeNull();
    expect(screen.queryByText('1 / 1')).toBeNull();
  });
});
