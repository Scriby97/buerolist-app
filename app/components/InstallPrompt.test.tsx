// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { InstallPrompt } from './InstallPrompt'

const fakePromptEvent = () =>
  Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: 'dismissed' as const }),
  })

// jsdom kennt matchMedia nicht - hier: nicht als installierte App (standalone) geoeffnet.
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia

afterEach(() => {
  window.__deferredInstallPrompt = null
})

describe('InstallPrompt', () => {
  it('zeigt den Button, wenn das Event schon vor dem Mount abgefangen wurde (Neuladen)', () => {
    window.__deferredInstallPrompt = fakePromptEvent()
    render(<InstallPrompt />)
    expect(screen.getByRole('button', { name: 'App installieren' })).toBeTruthy()
  })

  it('zeigt den Button, wenn das Event erst nach dem Mount kommt', () => {
    render(<InstallPrompt />)
    expect(screen.queryByRole('button', { name: 'App installieren' })).toBeNull()

    act(() => {
      window.__deferredInstallPrompt = fakePromptEvent()
      window.dispatchEvent(new Event('installpromptchange'))
    })
    expect(screen.getByRole('button', { name: 'App installieren' })).toBeTruthy()
  })
})
