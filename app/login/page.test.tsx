// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import LoginPage from './page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ signIn: vi.fn(), supabaseUser: null }),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('zeigt auf einem neuen Geraet deutlich den Weg zur Registrierung', () => {
    renderWithIntl(<LoginPage />)
    expect(screen.getByText('Neu bei Bürolist?')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Konto erstellen' }).getAttribute('href')).toBe('/register')
  })

  it('zeigt den Hinweis nicht, wenn hier schon jemand angemeldet war', () => {
    window.localStorage.setItem('buerolist:hasSignedIn', '1')
    renderWithIntl(<LoginPage />)
    expect(screen.queryByText('Neu bei Bürolist?')).toBeNull()
    expect(screen.getByRole('link', { name: 'Registrieren' })).toBeTruthy()
  })
})
