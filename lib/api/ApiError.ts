/**
 * Fehler, der beim Fehlschlagen eines API-Requests geworfen wird. `message`
 * ist immer gesetzt (Fallback-Text vom Backend, siehe buerolist-server
 * common/exceptions - je nach Backend-Version Deutsch oder Englisch, nicht
 * garantiert übersetzt). `code`/`params` sind optional (nur gesetzt, wenn das
 * Backend sie mitschickt) und werden von useApiErrorMessage() genutzt, um die
 * Meldung in der aktuellen UI-Sprache anzuzeigen (siehe messages/*.json,
 * Namespace `errors` - die Keys dort entsprechen exakt den Backend-Codes).
 */
export class ApiError extends Error {
  readonly code?: string
  readonly params?: Record<string, string | number>
  readonly status: number

  constructor(
    message: string,
    options: { code?: string; params?: Record<string, string | number>; status: number }
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code
    this.params = options.params
    this.status = options.status
  }
}

/**
 * Liest den Fehler-Body einer fehlgeschlagenen API-Response (`{ message, code,
 * params }`, siehe buerolist-server common/exceptions) und wirft einen
 * ApiError. Ersetzt das in jeder lib/api/*.ts-Datei wiederholte
 * `response.json().catch(() => ({message: '...'})); throw new Error(...)`
 * Boilerplate durch einen Einzeiler pro Call-Site.
 *
 * (Bewusst in derselben Datei wie ApiError statt in einer separaten
 * apiError.ts - Windows-Dateisysteme sind standardmäßig case-insensitiv,
 * `ApiError.ts` und `apiError.ts` wären also dieselbe Datei gewesen.)
 */
export async function throwApiError(
  response: Response,
  fallbackMessage: string
): Promise<never> {
  const body = await response.json().catch(() => ({}))
  throw new ApiError(body.message || fallbackMessage, {
    code: typeof body.code === 'string' ? body.code : undefined,
    params: body.params && typeof body.params === 'object' ? body.params : undefined,
    status: response.status,
  })
}
