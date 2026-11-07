// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import SettingsAccountPage from './page'

const updateName = vi.fn()
const refreshUserRole = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { updateUser: vi.fn() } }) }))
vi.mock('@/lib/api/profile', () => ({ updateName: (...args: unknown[]) => updateName(...args) }))
vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({
    supabaseUser: { email: 'martin@3xgermann.ch' },
    userProfile: { firstName: 'Martin', lastName: 'Germann' },
    loading: false,
    signOut: vi.fn(),
    refreshUserRole,
  }),
}))

describe('SettingsAccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateName.mockResolvedValue(undefined)
  })

  it('zeigt den eigenen Namen und speichert eine Aenderung', async () => {
    renderWithIntl(<SettingsAccountPage />)
    const firstName = screen.getByLabelText('Vorname') as HTMLInputElement
    expect(firstName.value).toBe('Martin')
    expect((screen.getByLabelText('Nachname') as HTMLInputElement).value).toBe('Germann')

    const save = screen.getByRole('button', { name: 'Name speichern' }) as HTMLButtonElement
    expect(save.disabled).toBe(true) // noch nichts geaendert

    fireEvent.change(firstName, { target: { value: ' Martin Peter ' } })
    fireEvent.click(save)

    await waitFor(() => expect(updateName).toHaveBeenCalledWith({ firstName: 'Martin Peter', lastName: 'Germann' }))
    expect(refreshUserRole).toHaveBeenCalled()
  })
})
