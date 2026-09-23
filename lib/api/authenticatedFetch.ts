import { createClient } from '@/lib/supabase/client'
import type { Session } from '@supabase/supabase-js'

// Global loading callbacks - set by ApiLoadingContext
let globalStartLoading: (() => void) | null = null
let globalStopLoading: (() => void) | null = null

export function setLoadingCallbacks(start: () => void, stop: () => void) {
  globalStartLoading = start
  globalStopLoading = stop
}

interface AuthenticatedFetchOptions extends RequestInit {
  retries?: number
  retryDelay?: number
  useExponentialBackoff?: boolean
  onRetry?: (attempt: number, maxRetries: number) => void
  skipLoadingIndicator?: boolean
}

/**
 * Makes an authenticated fetch request to the backend API.
 * Automatically adds the Authorization header with the Supabase JWT token.
 * Supports retry logic for cold starts (e.g., Render free tier).
 */
export async function authenticatedFetch(
  url: string,
  options: AuthenticatedFetchOptions = {}
): Promise<Response> {
  const {
    retries = 0,
    retryDelay = 5000,
    useExponentialBackoff = false,
    onRetry,
    skipLoadingIndicator = false,
    ...fetchOptions
  } = options

  if (!skipLoadingIndicator && globalStartLoading) {
    globalStartLoading()
  }

  try {
    const supabase = createClient()

    // Get the current session token with a 10-second timeout
    const getSessionWithTimeout = Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Session timeout – bitte Seite neu laden')), 10000)
      ),
    ])

    let session: Session | null
    try {
      const result = await getSessionWithTimeout
      session = result.data.session
    } catch (error) {
      console.error('Fehler beim Abrufen der Session:', error)
      throw error
    }

    if (!session?.access_token) {
      throw new Error('Keine aktive Session. Bitte zuerst anmelden.')
    }

    // Bei FormData (Datei-Uploads) den Content-Type NICHT setzen - der Browser
    // muss die multipart-Boundary selbst ergänzen.
    const isFormData =
      typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData

    const headers = {
      ...fetchOptions.headers,
      Authorization: `Bearer ${session.access_token}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          headers,
          signal: AbortSignal.timeout(20000),
        })

        // Return immediately for 2xx success or 4xx client errors
        if (response.ok || (response.status >= 400 && response.status < 500)) {
          return response
        }

        // Retry on 5xx server errors
        if (attempt < retries) {
          const currentDelay = useExponentialBackoff
            ? retryDelay * Math.pow(1.5, attempt)
            : retryDelay
          if (onRetry) onRetry(attempt + 1, retries)
          await new Promise(resolve => setTimeout(resolve, currentDelay))
          continue
        }

        return response
      } catch (error) {
        lastError = error as Error

        if (attempt < retries) {
          const currentDelay = useExponentialBackoff
            ? retryDelay * Math.pow(1.5, attempt)
            : retryDelay
          if (onRetry) onRetry(attempt + 1, retries)
          await new Promise(resolve => setTimeout(resolve, currentDelay))
          continue
        }

        throw error
      }
    }

    throw lastError || new Error('Anfrage nach Wiederholungsversuchen fehlgeschlagen')
  } finally {
    if (!skipLoadingIndicator && globalStopLoading) {
      globalStopLoading()
    }
  }
}
