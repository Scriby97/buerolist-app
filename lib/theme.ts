export type ThemePreference = 'system' | 'dark' | 'light'

const STORAGE_KEY = 'buerolist-theme'

export function getStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored
  }

  return 'system'
}

export function setStoredTheme(theme: ThemePreference) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, theme)
}

export function applyTheme(theme: ThemePreference) {
  if (typeof window === 'undefined') {
    return
  }

  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark)

  root.classList.toggle('dark', shouldUseDark)
  root.dataset.theme = theme
  root.style.colorScheme = shouldUseDark ? 'dark' : 'light'
}

export function getThemeStorageKey() {
  return STORAGE_KEY
}
