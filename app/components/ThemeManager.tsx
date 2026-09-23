'use client'

import { useEffect } from 'react'
import { applyTheme, getStoredTheme, getThemeStorageKey } from '@/lib/theme'

export function ThemeManager() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleMediaChange = () => {
      if (getStoredTheme() === 'system') {
        applyTheme('system')
      }
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === getThemeStorageKey()) {
        applyTheme(getStoredTheme())
      }
    }

    applyTheme(getStoredTheme())
    mediaQuery.addEventListener('change', handleMediaChange)
    window.addEventListener('storage', handleStorage)

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  return null
}
