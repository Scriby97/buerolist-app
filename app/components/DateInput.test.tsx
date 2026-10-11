import { describe, it, expect } from 'vitest';
import { formatDateCH } from './DateInput';

describe('formatDateCH', () => {
  it('formatiert ISO-Datum als TT.MM.JJJJ', () => {
    expect(formatDateCH('2026-10-11')).toBe('11.10.2026');
  });

  it('gibt bei leerem oder ungueltigem Wert einen leeren String zurueck', () => {
    expect(formatDateCH('')).toBe('');
    expect(formatDateCH('2026-10')).toBe('');
  });
});
