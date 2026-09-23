import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isSupportedLocale } from './locales';

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isSupportedLocale } from './locales';
export type { AppLocale } from './locales';

// Kein URL-Praefix (kein /de/..., /en/...) - die Sprache ist eine Einstellung,
// server-seitig aus einem Cookie gelesen (kein Flackern beim ersten Request
// wie es bei einer reinen localStorage-Loesung passieren wuerde). Der
// Sprachumschalter in UserMenu.tsx setzt dieses Cookie und ruft
// router.refresh() auf.
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
