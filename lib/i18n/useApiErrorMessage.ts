import { useTranslations } from 'next-intl'
import { ApiError } from '@/lib/api/ApiError'
import { KNOWN_ERROR_CODES } from './errorCodes'

/**
 * Übersetzt einen aus einem API-Call gefangenen Fehler in einen für den
 * Nutzer anzuzeigenden String, in der aktuell gewählten UI-Sprache.
 *
 * - Ist der Fehler ein ApiError mit einem uns bekannten `code` (siehe
 *   errorCodes.ts): übersetzter Text aus dem `errors`-Namespace, inkl.
 *   `{param}`-Interpolation.
 * - Sonst, falls es ein Error mit `.message` ist: die rohe Backend-Message
 *   (Fallback-Text vom Server, siehe ApiError.ts) - besser als eine
 *   generische Meldung, aber ggf. nicht in der aktuellen UI-Sprache.
 * - Sonst: der übergebene `fallback`-String.
 *
 * Verwendung ersetzt das bisherige `err instanceof Error ? err.message : t('...')`
 * Muster an jeder Catch-Stelle 1:1 durch `getApiErrorMessage(err, t('...'))`.
 */
export function useApiErrorMessage() {
  const t = useTranslations('errors')

  return (err: unknown, fallback: string): string => {
    if (err instanceof ApiError && err.code && KNOWN_ERROR_CODES.has(err.code as never)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return t(err.code as any, err.params as any)
    }
    if (err instanceof Error && err.message) {
      return err.message
    }
    return fallback
  }
}
