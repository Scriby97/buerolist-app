// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test/renderWithIntl'
import { CreateAbsenceForm } from './CreateAbsenceForm'

const createAbsences = vi.fn()
vi.mock('@/lib/api/url', () => ({ getApiBaseUrlOrNull: () => 'http://api' }))
vi.mock('@/lib/api/absences', () => ({
  getAbsenceReasons: () =>
    Promise.resolve([
      { id: 'r1', organizationId: 'org', name: 'Krankheit', sortOrder: 1 },
      { id: 'r4', organizationId: 'org', name: 'Feuerwehr', sortOrder: 4 },
    ]),
  createAbsences: (...args: unknown[]) => createAbsences(...args),
}))

const renderForm = (props: Partial<Parameters<typeof CreateAbsenceForm>[0]> = {}) => {
  const onSaved = vi.fn()
  renderWithIntl(
    <CreateAbsenceForm
      organizationId="org"
      selectedIds={['me']}
      myId="me"
      canManage={false}
      ownWorkdayMinutes={525}
      onSaved={onSaved}
      {...props}
    />,
  )
  return onSaved
}

describe('CreateAbsenceForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createAbsences.mockResolvedValue([{ id: 'a1' }])
  })

  it('speichert einen ganzen Tag mit dem ersten Grund', async () => {
    const onSaved = renderForm()
    expect(await screen.findByRole('option', { name: 'Krankheit' })).toBeTruthy()
    expect(screen.getByText('Gemäss deinen Arbeitszeiten: 8.75 h pro Tag.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abwesenheit speichern' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1))
    const payload = createAbsences.mock.calls[0][0]
    expect(payload).toMatchObject({ organizationId: 'org', reasonId: 'r1', portion: 'full' })
    expect(payload.to).toBeUndefined()
    expect(payload.creatorId).toBeUndefined()
  })

  it('erfasst Stunden fuer eine andere Person', async () => {
    renderForm({ selectedIds: ['anna'], canManage: true })
    await screen.findByRole('option', { name: 'Feuerwehr' })
    fireEvent.change(screen.getByLabelText('Grund'), { target: { value: 'r4' } })
    fireEvent.click(screen.getByLabelText('Stunden'))
    fireEvent.change(screen.getByPlaceholderText('z.B. 2.5'), { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abwesenheit speichern' }))

    await waitFor(() => expect(createAbsences).toHaveBeenCalled())
    expect(createAbsences.mock.calls[0][0]).toMatchObject({
      reasonId: 'r4',
      portion: 'hours',
      minutes: 150,
      creatorId: 'anna',
    })
  })
})
