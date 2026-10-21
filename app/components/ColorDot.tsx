import type { FC } from 'react';
import { colorVars, ENTITY_BG, type EntityColor } from '@/lib/colors/entityColors';

/** Kleiner Farbpunkt in der Erkennungsfarbe eines Kunden/Projekts. */
export const ColorDot: FC<{ color: EntityColor; className?: string }> = ({ color, className = '' }) => (
  <span
    aria-hidden="true"
    style={colorVars(color)}
    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${ENTITY_BG} ${className}`}
  />
);
