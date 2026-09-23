function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

export function getApiBaseUrlOrNull(): string | null {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL
  if (!rawApiUrl) {
    return null
  }

  const normalizedApiUrl = normalizeUrl(rawApiUrl)
  return normalizedApiUrl.endsWith('/api') ? normalizedApiUrl : `${normalizedApiUrl}/api`
}

export function getApiBaseUrl(): string {
  const apiBaseUrl = getApiBaseUrlOrNull()
  if (!apiBaseUrl) {
    throw new Error('API URL nicht konfiguriert')
  }
  return apiBaseUrl
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getApiBaseUrl()}${normalizedPath}`
}
