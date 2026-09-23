import { describe, it, expect } from 'vitest'
import { isSupportedLocale, setLocaleCookie, SUPPORTED_LOCALES } from './locales'

describe('isSupportedLocale', () => {
  it('accepts every supported locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isSupportedLocale(locale)).toBe(true)
    }
  })

  it('rejects an unsupported locale', () => {
    expect(isSupportedLocale('es')).toBe(false)
  })

  it('rejects undefined', () => {
    expect(isSupportedLocale(undefined)).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isSupportedLocale('')).toBe(false)
  })
})

describe('setLocaleCookie', () => {
  it('does not throw when document is unavailable (SSR)', () => {
    // vitest's default (node) environment has no `document` global, exactly
    // like a server render - this exercises that guard.
    expect(() => setLocaleCookie('de')).not.toThrow()
  })
})
