// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { NotificationPermissionPrompt } from './NotificationPermissionPrompt'

const getReminderSettings = vi.fn()
const updateReminderSettings = vi.fn()
const ensurePushSubscription = vi.fn()

vi.mock('@/lib/auth/AuthProvider', () => ({
  useAuth: () => ({ supabaseUser: { id: 'u1' }, userProfile: { id: 'u1' }, hasOrganization: true }),
}))
vi.mock('@/lib/api/notifications', () => ({
  getReminderSettings: () => getReminderSettings(),
  updateReminderSettings: (enabled: boolean, time: string) => updateReminderSettings(enabled, time),
}))
vi.mock('@/lib/notifications/pushSubscription', () => ({
  isPushNotificationSupported: () => true,
  ensurePushSubscription: () => ensurePushSubscription(),
  PushPermissionError: class extends Error {},
}))

describe('NotificationPermissionPrompt', () => {
  beforeEach(() => {
    vi.stubGlobal('Notification', { permission: 'default' })
    getReminderSettings.mockResolvedValue({ userId: 'u1', enabled: true, reminderTime: '17:30' })
    updateReminderSettings.mockResolvedValue({})
    ensurePushSubscription.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('fragt einmalig und aktiviert die Erinnerung um 17:30', async () => {
    renderWithIntl(<NotificationPermissionPrompt />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aktivieren' }))
    await waitFor(() => expect(updateReminderSettings).toHaveBeenCalledWith(true, '17:30'))
    expect(ensurePushSubscription).toHaveBeenCalled()
  })

  it('fragt auch, wenn der Browser Benachrichtigungen schon erlaubt hat', async () => {
    vi.stubGlobal('Notification', { permission: 'granted' })
    renderWithIntl(<NotificationPermissionPrompt />)
    expect(await screen.findByRole('button', { name: 'Aktivieren' })).toBeTruthy()
  })

  it('fragt nicht, wenn Benachrichtigungen blockiert sind', async () => {
    vi.stubGlobal('Notification', { permission: 'denied' })
    renderWithIntl(<NotificationPermissionPrompt />)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(getReminderSettings).not.toHaveBeenCalled()
  })

  it('fragt nicht, wenn der User schon geantwortet hat', async () => {
    getReminderSettings.mockResolvedValue({ id: 'r1', userId: 'u1', enabled: false, reminderTime: '17:30' })
    renderWithIntl(<NotificationPermissionPrompt />)
    await waitFor(() => expect(getReminderSettings).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
