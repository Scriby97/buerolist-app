// Reine Konstanten/Typen ohne Server-only-Imports (next/headers), damit diese
// Datei sowohl von Server-Code (i18n/request.ts) als auch von Client
// Components (z.B. UserMenu.tsx fuer den Sprachumschalter) importiert werden
// kann, ohne next/headers ins Client-Bundle zu ziehen.
export const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'it'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'de';
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

export function isSupportedLocale(value: string | undefined): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Setzt das Sprach-Cookie (1 Jahr, wie next-intl's eigenes Cookie-Beispiel -
 * reine UI-Einstellung, kein sensibler Wert). Als eigenständige Funktion
 * (statt inline im Klick-Handler) ausgelagert, damit der direkte
 * document.cookie-Zugriff ausserhalb einer Komponente/eines Hooks liegt.
 */
export function setLocaleCookie(locale: AppLocale): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}
