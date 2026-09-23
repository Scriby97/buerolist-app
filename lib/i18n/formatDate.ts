import { useLocale } from 'next-intl';

// Next.js hat keinen eingebauten Locale->BCP47-Mapper - next-intl-Locales sind
// bereits gueltige BCP47-Tags (de, en, fr, it), aber wir mappen sie explizit
// auf die Schweizer Varianten, wo sinnvoll (Datumsformat), damit sich das
// Format bei einem generischen 'de' nicht von der bisherigen deutschen
// Standardanzeige (frueher hart 'de-DE') unterscheidet.
const BCP47_MAP: Record<string, string> = {
  de: 'de-CH',
  en: 'en-GB',
  fr: 'fr-CH',
  it: 'it-CH',
};

export function useDateLocale(): string {
  const locale = useLocale();
  return BCP47_MAP[locale] ?? locale;
}

export function formatDate(date: Date | string | number, locale: string): string {
  return new Date(date).toLocaleDateString(locale);
}
